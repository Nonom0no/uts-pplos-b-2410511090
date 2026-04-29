<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\ExpiredException;
use Firebase\JWT\SignatureInvalidException;

class JwtMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json([
                'success' => false,
                'message' => 'Token tidak disertakan',
            ], 401);
        }

        try {
            $secret  = config('app.jwt_secret', env('JWT_SECRET'));
            $decoded = JWT::decode($token, new Key($secret, 'HS256'));

            // Simpan data user ke request agar bisa dipakai controller
            $request->merge(['auth_user' => (array) $decoded]);
            $request->attributes->set('auth_user', (array) $decoded);

        } catch (ExpiredException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Token sudah kadaluarsa',
            ], 401);

        } catch (SignatureInvalidException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Token tidak valid',
            ], 401);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Token tidak dapat diverifikasi: ' . $e->getMessage(),
            ], 401);
        }

        return $next($request);
    }
}