import express from 'express';
import multer from 'multer';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth.middleware';
import { scanPurchaseBill, commitInwardStock } from '../controllers/purchases.controller';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Get all purchase bills
router.get('/bills', authenticate, async (req, res) => {
  try {
    const bills = await prisma.purchaseBill.findMany({
      include: {
        supplier: true,
        items: { include: { product: true } }
      },
      orderBy: { date: 'desc' }
    });
    res.json(bills);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch purchase bills' });
  }
});

// AI Inward Bill Scanner - upload file or base64
router.post('/scan-bill', authenticate, upload.single('billFile'), scanPurchaseBill);

// Commit confirmed inward stock items
router.post('/commit-inward-stock', authenticate, commitInwardStock);

export default router;
