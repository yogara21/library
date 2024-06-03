const express = require('express');
const router = express.Router();

//import express validator
const { body, validationResult } = require('express-validator');

//import database
const connection = require('../config/database');

/**
 * @openapi
 * /api/books:
 *   get:
 *     summary: Mengambil semua buku yang tersedia
 *     description: Endpoint ini digunakan untuk mengambil semua buku yang tersedia dan belum dipinjam oleh siapapun.
 *     responses:
 *       200:
 *         description: Daftar buku berhasil diperoleh
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'List Data Buku'
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       code:
 *                         type: string
 *                         description: Kode buku
 *                       title:
 *                         type: string
 *                         description: Judul buku
 *                       author:
 *                         type: string
 *                         description: Penulis buku
 *                       stock:
 *                         type: integer
 *                         description: Jumlah stok buku
 *       500:
 *         description: Internal Server Error
 */
router.get('/', function (req, res) {
    // Query untuk mengambil semua buku dan jumlah yang tersedia
    const sql = `
    SELECT
    b.code, b.title, b.author, b.stock
    FROM
    books b
    LEFT JOIN loans l ON b.code = l.book_code AND l.return_date IS NULL
    GROUP BY
    b.code, b.title, b.author, b.stock
    HAVING COUNT(l.book_code) = 0;
    `;

    connection.query(sql, function (err, rows) {
        if (err) {
            return res.status(500).json({
                status: false,
                message: 'Internal Server Error',
            });
        } else {
            return res.status(200).json({
                status: true,
                message: 'List Data Buku',
                data: rows
            });
        }
    });
});

module.exports = router;