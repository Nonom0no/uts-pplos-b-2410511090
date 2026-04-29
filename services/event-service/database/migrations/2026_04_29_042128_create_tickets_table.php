<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tickets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('event_id')->constrained('events')->cascadeOnDelete();
            $table->foreignUuid('ticket_category_id')->constrained('ticket_categories');
            $table->string('owner_id');           // user_id dari auth-service
            $table->string('order_id')->nullable(); // order_id dari payment-service
            $table->string('qr_code')->unique();  // token unik untuk scan QR
            $table->enum('status', ['active', 'used', 'cancelled'])->default('active');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tickets');
    }
};