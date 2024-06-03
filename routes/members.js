const express = require('express');
const router = express.Router();

//import express validator
const { body, validationResult } = require('express-validator');

//import database
const connection = require('../config/database');

/**
 * @openapi
 * /api/members:
 *   get:
 *     summary: Mengembalikan daftar anggota dan jumlah peminjaman yang belum dikembalikan
 *     description: Endpoint ini mengembalikan daftar semua anggota beserta jumlah peminjaman buku yang belum dikembalikan.
 *     responses:
 *       200:
 *         description: Daftar anggota berhasil diperoleh
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   code:
 *                     type: string
 *                     description: Kode anggota
 *                   name:
 *                     type: string
 *                     description: Nama anggota
 *                   borrowed:
 *                     type: integer
 *                     description: Jumlah buku yang sedang dipinjam
 *       500:
 *         description: Internal Server Error
 */
router.get('/', function (req, res) {
    //query
    const sql = `
    SELECT
    m.code, m.name, COUNT(l.member_code) AS borrowed
    FROM
    members m
    LEFT JOIN loans l ON m.code = l.member_code AND l.return_date IS NULL
    GROUP BY
    m.code, m.name;
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
                message: 'List Data Members',
                data: rows
            });
        }
    });
});

module.exports = router;