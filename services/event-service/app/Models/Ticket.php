<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Support\Str;

class Ticket extends Model
{
    use HasUuids;

    protected $fillable = [
        'event_id', 'ticket_category_id', 'owner_id',
        'order_id', 'qr_code', 'status',
    ];

    protected static function boot()
    {
        parent::boot();
        // Auto-generate QR code token saat insert
        static::creating(function ($ticket) {
            if (empty($ticket->qr_code)) {
                $ticket->qr_code = Str::uuid()->toString();
            }
        });
    }

    public function event()
    {
        return $this->belongsTo(Event::class);
    }

    public function ticketCategory()
    {
        return $this->belongsTo(TicketCategory::class);
    }

    public function validations()
    {
        return $this->hasMany(TicketValidation::class);
    }
}