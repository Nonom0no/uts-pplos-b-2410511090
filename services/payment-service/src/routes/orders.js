const express = require('express');
const router  = express.Router();

const OrderController   = require('../controllers/OrderController');
const { jwtMiddleware } = require('../middlewares/jwtMiddleware');

// Semua order route wajib JWT
router.use(jwtMiddleware);

router.get('/',           OrderController.index);          // GET  /api/orders
router.get('/:id',        OrderController.show);           // GET  /api/orders/:id
router.post('/',          OrderController.checkout);       // POST /api/orders
router.post('/:id/confirm', OrderController.confirmPayment); // POST /api/orders/:id/confirm
router.delete('/:id',    OrderController.cancel);          // DELETE /api/orders/:id

module.exports = router;