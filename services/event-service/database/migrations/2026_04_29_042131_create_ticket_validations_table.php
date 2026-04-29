<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ticket_validations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('ticket_id')->constrained('tickets')->cascadeOnDelete();
            $table->string('validated_by');       // user_id petugas
            $table->timestamp('validated_at');
            $table->string('gate')->nullable();   // misal: Gate A, Gate B
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ticket_validations');
    }
};