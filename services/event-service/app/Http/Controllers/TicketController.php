<?php

namespace App\Http\Controllers;

use App\Models\Ticket;
use App\Models\TicketCategory;
use App\Models\TicketValidation;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class TicketController extends Controller
{
    /**
     * GET /api/tickets
     * Daftar tiket milik user yang sedang login
     */
    public function index(Request $request)
    {
        $authUser = $request->attributes->get('auth_user');

        $perPage = (int) $request->get('per_page', 10);
        $perPage = min(max($perPage, 1), 100);

        $tickets = Ticket::with(['event', 'ticketCategory'])
            ->where('owner_id', $authUser['id'])
            ->when($request->filled('status'), fn($q) => $q->where('status', $request->status))
            ->orderBy('created_at', 'desc')
            ->paginate($perPage, ['*'], 'page', $request->get('page', 1));

        return response()->json([
            'success' => true,
            'data'    => $tickets->items(),
            'meta'    => [
                'current_page' => $tickets->currentPage(),
                'per_page'     => $tickets->perPage(),
                'total'        => $tickets->total(),
                'last_page'    => $tickets->lastPage(),
            ],
        ], 200);
    }

    /**
     * GET /api/tickets/{id}
     * Detail tiket (hanya pemilik atau admin)
     */
    public function show(Request $request, string $id)
    {
        $authUser = $request->attributes->get('auth_user');
        $ticket   = Ticket::with(['event', 'ticketCategory', 'validations'])->find($id);

        if (!$ticket) {
            return response()->json(['success' => false, 'message' => 'Tiket tidak ditemukan'], 404);
        }

        if ($ticket->owner_id !== $authUser['id'] && $authUser['role'] !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Akses ditolak'], 403);
        }

        return response()->json(['success' => true, 'data' => $ticket], 200);
    }

    /**
     * POST /api/tickets
     * Buat tiket (dipanggil oleh payment-service setelah pembayaran berhasil)
     * Endpoint ini diproteksi service-to-service key, bukan JWT user
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'ticket_category_id' => 'required|uuid|exists:ticket_categories,id',
            'owner_id'           => 'required|string',
            'order_id'           => 'required|string',
            'quantity'           => 'required|integer|min:1',
        ]);

        $category = TicketCategory::lockForUpdate()->find($validated['ticket_category_id']);

        // Cek kuota
        if (($category->sold + $validated['quantity']) > $category->quota) {
            return response()->json([
                'success' => false,
                'message' => 'Kuota tiket tidak cukup',
            ], 422);
        }

        $created = [];

        for ($i = 0; $i < $validated['quantity']; $i++) {
            $ticket = Ticket::create([
                'id'                 => Str::uuid(),
                'event_id'           => $category->event_id,
                'ticket_category_id' => $category->id,
                'owner_id'           => $validated['owner_id'],
                'order_id'           => $validated['order_id'],
                'qr_code'            => Str::uuid()->toString(),
                'status'             => 'active',
            ]);
            $created[] = $ticket;
        }

        // Update sold count
        $category->increment('sold', $validated['quantity']);

        return response()->json([
            'success' => true,
            'message' => count($created) . ' tiket berhasil dibuat',
            'data'    => $created,
        ], 201);
    }

    /**
     * POST /api/tickets/validate-qr
     * Validasi QR code di pintu masuk event
     */
    public function validateQr(Request $request)
    {
        $validated = $request->validate([
            'qr_code' => 'required|string',
            'gate'    => 'nullable|string|max:50',
        ]);

        $authUser = $request->attributes->get('auth_user');
        $ticket   = Ticket::with('event')->where('qr_code', $validated['qr_code'])->first();

        if (!$ticket) {
            return response()->json(['success' => false, 'message' => 'QR code tidak valid'], 404);
        }

        if ($ticket->status === 'used') {
            return response()->json(['success' => false, 'message' => 'Tiket sudah pernah digunakan'], 409);
        }

        if ($ticket->status === 'cancelled') {
            return response()->json(['success' => false, 'message' => 'Tiket sudah dibatalkan'], 422);
        }

        // Tandai tiket sebagai used
        $ticket->update(['status' => 'used']);

        // Catat log validasi
        TicketValidation::create([
            'id'           => Str::uuid(),
            'ticket_id'    => $ticket->id,
            'validated_by' => $authUser['id'],
            'validated_at' => now(),
            'gate'         => $validated['gate'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Tiket valid dan berhasil di-scan',
            'data'    => [
                'ticket_id'  => $ticket->id,
                'owner_id'   => $ticket->owner_id,
                'event'      => $ticket->event->title ?? null,
                'event_date' => $ticket->event->event_date ?? null,
                'gate'       => $validated['gate'] ?? null,
            ],
        ], 200);
    }
}