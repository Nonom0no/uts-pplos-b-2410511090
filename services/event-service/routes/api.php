<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\EventController;
use App\Http\Controllers\TicketController;

// ── Health check ─────────────────────────────────────────────
Route::get('/health', function () {
    return response()->json(['status' => 'ok', 'service' => 'event-service', 'port' => 3002]);
});

// ── Event routes ─────────────────────────────────────────────
// GET listing & detail: publik (tanpa JWT)
Route::get('/events',      [EventController::class, 'index']);
Route::get('/events/{id}', [EventController::class, 'show']);

// Mutasi event: wajib JWT
Route::middleware('jwt')->group(function () {
    Route::post('/events',          [EventController::class, 'store']);
    Route::put('/events/{id}',      [EventController::class, 'update']);
    Route::delete('/events/{id}',   [EventController::class, 'destroy']);
});

// ── Ticket routes ─────────────────────────────────────────────
Route::middleware('jwt')->group(function () {
    Route::get('/tickets',              [TicketController::class, 'index']);
    Route::get('/tickets/{id}',         [TicketController::class, 'show']);
    Route::post('/tickets',             [TicketController::class, 'store']);       // dipanggil payment-service
    Route::post('/tickets/validate-qr', [TicketController::class, 'validateQr']);
});