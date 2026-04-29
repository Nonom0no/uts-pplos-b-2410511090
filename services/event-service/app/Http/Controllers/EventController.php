<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\TicketCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class EventController extends Controller
{
    /**
     * GET /api/events
     * Listing event dengan paging + filtering (publik)
     */
    public function index(Request $request)
    {
        $query = Event::with('ticketCategories');

        // ── Filtering ───────────────────────────────────────
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $query->where('title', 'like', '%' . $request->search . '%');
        }

        if ($request->filled('date_from')) {
            $query->whereDate('event_date', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('event_date', '<=', $request->date_to);
        }

        // ── Paging ──────────────────────────────────────────
        $perPage = (int) $request->get('per_page', 10);
        $perPage = min(max($perPage, 1), 100); // clamp 1–100

        $events = $query->orderBy('event_date', 'asc')
                        ->paginate($perPage, ['*'], 'page', $request->get('page', 1));

        return response()->json([
            'success' => true,
            'data'    => $events->items(),
            'meta'    => [
                'current_page' => $events->currentPage(),
                'per_page'     => $events->perPage(),
                'total'        => $events->total(),
                'last_page'    => $events->lastPage(),
            ],
        ], 200);
    }

    /**
     * GET /api/events/{id}
     * Detail event beserta kategori tiket
     */
    public function show(string $id)
    {
        $event = Event::with('ticketCategories')->find($id);

        if (!$event) {
            return response()->json(['success' => false, 'message' => 'Event tidak ditemukan'], 404);
        }

        return response()->json(['success' => true, 'data' => $event], 200);
    }

    /**
     * POST /api/events
     * Buat event baru (hanya admin)
     */
    public function store(Request $request)
    {
        // Validasi input
        $validated = $request->validate([
            'title'       => 'required|string|max:255',
            'description' => 'nullable|string',
            'location'    => 'required|string|max:255',
            'event_date'  => 'required|date|after:now',
            'banner_url'  => 'nullable|url',
            'status'      => 'nullable|in:draft,published,cancelled',
            'categories'  => 'nullable|array',
            'categories.*.name'  => 'required_with:categories|string',
            'categories.*.price' => 'required_with:categories|numeric|min:0',
            'categories.*.quota' => 'required_with:categories|integer|min:1',
        ]);

        $authUser = $request->attributes->get('auth_user');

        $event = Event::create([
            'id'           => Str::uuid(),
            'title'        => $validated['title'],
            'description'  => $validated['description'] ?? null,
            'location'     => $validated['location'],
            'event_date'   => $validated['event_date'],
            'organizer_id' => $authUser['id'],
            'banner_url'   => $validated['banner_url'] ?? null,
            'status'       => $validated['status'] ?? 'draft',
        ]);

        // Buat kategori tiket jika disertakan
        if (!empty($validated['categories'])) {
            foreach ($validated['categories'] as $cat) {
                TicketCategory::create([
                    'id'       => Str::uuid(),
                    'event_id' => $event->id,
                    'name'     => $cat['name'],
                    'price'    => $cat['price'],
                    'quota'    => $cat['quota'],
                ]);
            }
        }

        $event->load('ticketCategories');

        return response()->json([
            'success' => true,
            'message' => 'Event berhasil dibuat',
            'data'    => $event,
        ], 201);
    }

    /**
     * PUT /api/events/{id}
     * Update event (hanya organizer atau admin)
     */
    public function update(Request $request, string $id)
    {
        $event = Event::find($id);
        if (!$event) {
            return response()->json(['success' => false, 'message' => 'Event tidak ditemukan'], 404);
        }

        $authUser = $request->attributes->get('auth_user');
        if ($event->organizer_id !== $authUser['id'] && $authUser['role'] !== 'admin') {
            return response()->json(['success' => false, 'message' => 'Akses ditolak'], 403);
        }

        $validated = $request->validate([
            'title'       => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'location'    => 'sometimes|string|max:255',
            'event_date'  => 'sometimes|date',
            'banner_url'  => 'nullable|url',
            'status'      => 'sometimes|in:draft,published,cancelled',
        ]);

        $event->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Event berhasil diperbarui',
            'data'    => $event->fresh('ticketCategories'),
        ], 200);
    }

    /**
     * DELETE /api/events/{id}
     * Hapus event (hanya admin)
     */
    public function destroy(Request $request, string $id)
    {
        $event = Event::find($id);
        if (!$event) {
            return response()->json(['success' => false, 'message' => 'Event tidak ditemukan'], 404);
        }

        $event->delete();

        return response()->json(null, 204);
    }
}