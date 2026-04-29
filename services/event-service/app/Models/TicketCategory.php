<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class TicketCategory extends Model
{
    use HasUuids;

    protected $fillable = ['event_id', 'name', 'price', 'quota', 'sold'];

    protected $casts = [
        'price' => 'float',
        'quota' => 'integer',
        'sold'  => 'integer',
    ];

    public function event()
    {
        return $this->belongsTo(Event::class);
    }

    public function tickets()
    {
        return $this->hasMany(Ticket::class);
    }

    /**
     * Sisa kuota tiket
     */
    public function getAvailableAttribute(): int
    {
        return max(0, $this->quota - $this->sold);
    }
}