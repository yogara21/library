const express = require('express');
const router = express.Router();

//import express validator
const { body, validationResult } = require('express-validator');

//import database
const connection = require('../config/database');

   /**
    * @openapi
    * /api/loans:
    *   get:
    *     summary: Mengembalikan daftar pinjaman
    *     description: Endpoint ini mengembalikan daftar semua pinjaman yang ada di database.
    *     responses:
    *       200:
    *         description: Daftar pinjaman berhasil diperoleh
    *         content:
    *           application/json:
    *             schema:
    *               type: array
    *               items:
    *                 type: object
    *                 properties:
    *                   id:
    *                     type: integer
    *                     description: ID dari pinjaman
    *                   amount:
    *                     type: number
    *                     description: Jumlah dari pinjaman
    *                   member_code:
    *                     type: string
    *                     description: Kode anggota yang meminjam
    *                   book_code:
    *                     type: string
    *                     description: Kode buku yang dipinjam
    *                   due_date:
    *                     type: string
    *                     format: date
    *                     description: Tanggal pengembalian pinjaman
    */
router.get('/', function (req, res) {
    //query
    connection.query('SELECT * FROM loans ORDER BY id DESC', function (err, rows) {
        if (err) {
            return res.status(500).json({
                status: false,
                message: 'Internal Server Error',
            })
        } else {
            return res.status(200).json({
                status: true,
                message: 'Daftar Pinjaman Berhasil Diperoleh',
                data: rows
            })
        }
    });
});

/**
 * @openapi
 * /api/loans/store:
 *   post:
 *     summary: Menyimpan data pinjaman baru
 *     description: Endpoint ini digunakan untuk menyimpan data pinjaman baru ke dalam database.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - book_code
 *               - member_code
 *             properties:
 *               book_code:
 *                 type: string
 *                 description: Kode buku yang dipinjam
 *               member_code:
 *                 type: string
 *                 description: Kode anggota yang meminjam
 *     responses:
 *       201:
 *         description: Data pinjaman berhasil disimpan
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
 *                   example: 'Insert Data Successfully'
 *                 data:
 *                   type: integer
 *                   description: ID dari data pinjaman yang baru disimpan
 *       400:
 *         description: Kesalahan validasi atau aturan bisnis tidak terpenuhi
 *       403:
 *         description: Member sedang dalam masa penalti
 *       404:
 *         description: Kode buku atau kode member tidak ditemukan
 *       500:
 *         description: Internal Server Error
 */
router.post('/store', [
    body('book_code').notEmpty(),
    body('member_code').notEmpty()
], async (req, res) => {
    const { member_code, book_code } = req.body;
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }
        
        // Check member exists
        const [memberError, members] = await new Promise(resolve => {
            connection.query('SELECT * FROM members WHERE code = ?', [member_code], function (err, members) {
                resolve([err, members]);
            });
        });
        if (memberError) throw new Error('Error checking member code');
        if (members.length === 0) {
            return res.status(404).json({
                status: false,
                message: 'Member code not found'
            });
        }

        // Cek apakah member sedang dalam masa penalti
        const [penaltyError, penaltyResult] = await new Promise(resolve => {
            connection.query('SELECT penalty_until FROM members WHERE code = ?', [member_code], function (err, results) {
                resolve([err, results]);
            });
        });
        if (penaltyError) throw new Error('Database error saat memeriksa penalti member');
        if (penaltyResult.length > 0 && penaltyResult[0].penalty_until && new Date(penaltyResult[0].penalty_until) > new Date()) {
            return res.status(403).json({
                status: false,
                message: `Member sedang dalam masa penalti dan tidak dapat meminjam buku. Penalti berakhir pada ${penaltyResult[0].penalty_until.toLocaleString()}.`
            });
        }

        // Check book exists
        const [bookError, books] = await new Promise(resolve => {
            connection.query('SELECT * FROM books WHERE code = ?', [book_code], function (err, books) {
                resolve([err, books]);
            });
        });
        if (bookError) throw new Error('Error checking book code');
        if (books.length === 0) {
            return res.status(404).json({
                status: false,
                message: 'Book code not found'
            });
        }

        // Insert data
        let formData = {
            book_code: book_code,
            member_code: member_code,
            loan_date: new Date()
        };

        // Cek jumlah buku yang sudah dipinjam oleh member
        const [countError, results] = await new Promise(resolve => {
            connection.query(
                'SELECT COUNT(*) AS count FROM loans WHERE member_code = ? AND return_date IS NULL',
                [member_code],
                (error, results) => {
                    resolve([error, results]);
                }
            );
        });
        if (countError) throw new Error('Database error');
        
        // Cek apakah member sudah meminjam lebih dari 2 buku
        if (results[0].count >= 2) {
            return res.status(400).json({ message: 'Member tidak dapat meminjam lebih dari 2 buku.' });
        }

        // Cek apakah buku yang ingin dipinjam sudah dipinjam oleh member lain dan belum dikembalikan
        const [bookLoanError, bookLoanResults] = await new Promise(resolve => {
            connection.query(
                'SELECT * FROM loans WHERE book_code = ? AND return_date IS NULL',
                [book_code],
                (error, results) => {
                    resolve([error, results]);
                }
            );
        });
        if (bookLoanError) throw new Error('Database error saat memeriksa status peminjaman buku');

        if (bookLoanResults.length > 0) {
            return res.status(400).json({ message: 'Buku ini sedang dipinjam dan belum dikembalikan.' });
        }

        const [insertError, result] = await new Promise(resolve => {
            connection.query('INSERT INTO loans SET ?', formData, function (err, result) {
                resolve([err, result]);
            });
        });
        if (insertError) throw new Error('Internal Server Error');

        return res.status(201).json({
            status: true,
            message: 'Insert Data Successfully',
            data: result.insertId
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            message: error.message
        });
    }
});

/**
 * RETURN LOANS
 * @openapi
 * /api/loans/return:
 *   post:
 *     summary: Mengembalikan buku yang dipinjam
 *     description: Endpoint ini digunakan untuk mengembalikan buku yang telah dipinjam oleh member.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - book_code
 *               - member_code
 *             properties:
 *               book_code:
 *                 type: string
 *                 description: Kode buku yang dikembalikan
 *               member_code:
 *                 type: string
 *                 description: Kode member yang mengembalikan buku
 *     responses:
 *       200:
 *         description: Buku berhasil dikembalikan
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
 *                   example: 'Buku berhasil dikembalikan.'
 *       404:
 *         description: Tidak ada peminjaman buku yang cocok dengan data yang diberikan
 *       500:
 *         description: Internal Server Error
 */
router.post('/return', [
    body('book_code').notEmpty(),
    body('member_code').notEmpty()
], async (req, res) => {
    const { member_code, book_code } = req.body;
    try {
        // Cek apakah buku yang ingin dikembalikan memang dipinjam oleh member tersebut
        const [loanError, loan] = await new Promise(resolve => {
            connection.query(
                'SELECT * FROM loans WHERE book_code = ? AND member_code = ? AND return_date IS NULL',
                [book_code, member_code],
                (err, results) => {
                    resolve([err, results]);
                }
            );
        });
        if (loanError) throw new Error('Database error saat memeriksa peminjaman buku');
        if (loan.length === 0) {
            return res.status(404).json({
                status: false,
                message: 'Tidak ada peminjaman buku yang cocok dengan data yang diberikan.'
            });
        }

        // Hitung selisih hari
        const loanDate = new Date(loan[0].loan_date);
        const returnDate = new Date();
        const diffTime = Math.abs(returnDate - loanDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Update data peminjaman dengan tanggal pengembalian
        const [updateError] = await new Promise(resolve => {
            connection.query(
                'UPDATE loans SET return_date = ? WHERE book_code = ? AND member_code = ?',
                [returnDate, book_code, member_code],
                (err, result) => {
                    resolve([err, result]);
                }
            );
        });
        if (updateError) throw new Error('Database error saat mengupdate data peminjaman');

        // Cek apakah terdapat penalti
        if (diffDays > 7) {
            // Tandai member dengan status penalti
            const [penaltyError] = await new Promise(resolve => {
                connection.query(
                    'UPDATE members SET penalty_until = ? WHERE code = ?',
                    [new Date(returnDate.getTime() + (3 * 24 * 60 * 60 * 1000)), member_code], // Penalti 3 hari
                    (err, result) => {
                        resolve([err, result]);
                    }
                );
            });
            if (penaltyError) throw new Error('Database error saat menandai penalti member');

            return res.status(200).json({
                status: true,
                message: 'Buku dikembalikan dengan penalti. Member tidak dapat meminjam buku selama 3 hari.'
            });
        }

        return res.status(200).json({
            status: true,
            message: 'Buku berhasil dikembalikan.'
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            message: error.message
        });
    }
});

module.exports = router;
