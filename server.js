const express = require("express");

const app = express();

app.use(express.json());

// ========================================
// DATA STORAGE
// ========================================

const donations = [];
const processedDonations = new Set();

let totalDonasi = 0;
let totalDonatur = new Set();

// ========================================
// HOME
// ========================================

app.get("/", (req, res) => {
    res.json({
        status: "online",
        message: "Saweria KALCERLOUNGE Railway Online"
    });
});

// ========================================
// HEALTH CHECK
// ========================================

app.get("/health", (req, res) => {
    res.json({
        status: "ok"
    });
});

// ========================================
// RECEIVE DONATION FROM GOOGLE SCRIPT
// ========================================

app.post("/saweria", (req, res) => {
    try {
        console.log("========================================");
        console.log("DATA SAWERIA DITERIMA");
        console.log(req.body);
        console.log("========================================");

        const data = req.body || {};

        // Ambil data dengan beberapa kemungkinan nama field
        const nama =
            data.nama ||
            data.donor_name ||
            data.name ||
            "Anonymous";

        const jumlah =
            Number(
                data.jumlah ||
                data.amount ||
                data.amount_raw ||
                0
            );

        const pesan =
            data.pesan ||
            data.message ||
            "";

        const robloxUsername =
            data.robloxUsername ||
            data.roblox_username ||
            "";

        // ========================================
        // BUAT ID DONASI
        // ========================================

        const donationId =
            data.id ||
            data.donation_id ||
            data.transaction_id ||
            `${nama}-${jumlah}-${pesan}-${Date.now()}`;

        // ========================================
        // CEGAH DUPLIKAT
        // ========================================

        if (processedDonations.has(String(donationId))) {
            console.log("⚠️ Donasi duplikat diabaikan:", donationId);

            return res.json({
                success: true,
                duplicate: true,
                message: "Donasi sudah diterima sebelumnya"
            });
        }

        processedDonations.add(String(donationId));

        // ========================================
        // FORMAT DATA UNTUK ROBLOX
        // ========================================

        const donation = {
            id: String(donationId),
            nama: String(nama),
            jumlah: jumlah,
            pesan: String(pesan),
            robloxUsername: String(robloxUsername),

            // Format tambahan
            formatted:
                "Rp" + jumlah.toLocaleString("id-ID"),

            timestamp: Date.now()
        };

        // ========================================
        // MASUKKAN KE QUEUE
        // ========================================

        donations.push(donation);

        // ========================================
        // UPDATE STATS
        // ========================================

        totalDonasi += jumlah;

        totalDonatur.add(String(nama));

        console.log("✅ DONASI DISIMPAN:");
        console.log(donation);

        console.log("Total donasi:", totalDonasi);
        console.log("Total donatur:", totalDonatur.size);
        console.log("Queue:", donations.length);

        res.json({
            success: true,
            message: "Donasi berhasil disimpan",
            donation: donation
        });

    } catch (error) {
        console.error("❌ ERROR /saweria:", error);

        res.status(500).json({
            success: false,
            error: error.toString()
        });
    }
});

// ========================================
// ROBLOX: CEK DONASI
// ========================================

app.get("/cek", (req, res) => {
    try {
        console.log("🎮 Roblox meminta /cek");

        // Ambil semua donasi yang belum diambil Roblox
        const result = donations.splice(0, donations.length);

        console.log("📦 Donasi dikirim ke Roblox:", result.length);

        res.json(result);

    } catch (error) {
        console.error("❌ ERROR /cek:", error);

        res.status(500).json({
            success: false,
            error: error.toString()
        });
    }
});

// ========================================
// ROBLOX: TOP DONATUR
// ========================================

app.get("/top", (req, res) => {
    try {
        const grouped = {};

        for (const donation of donations) {
            const key = donation.nama;

            if (!grouped[key]) {
                grouped[key] = {
                    nama: donation.nama,
                    total: 0,
                    count: 0,
                    robloxUsername: donation.robloxUsername || ""
                };
            }

            grouped[key].total += donation.jumlah;
            grouped[key].count += 1;
        }

        const top = Object.values(grouped)
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);

        res.json(top);

    } catch (error) {
        console.error("❌ ERROR /top:", error);

        res.status(500).json({
            success: false,
            error: error.toString()
        });
    }
});

// ========================================
// ROBLOX: STATS
// ========================================

app.get("/stats", (req, res) => {
    try {
        res.json({
            totalDonasi: totalDonasi,
            totalDonatur: totalDonatur.size
        });

    } catch (error) {
        console.error("❌ ERROR /stats:", error);

        res.status(500).json({
            success: false,
            error: error.toString()
        });
    }
});

// ========================================
// START SERVER
// ========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log("========================================");
    console.log("🎁 SAWERIA KALCERLOUNGE RAILWAY");
    console.log("========================================");
    console.log(`🚀 Server berjalan di port ${PORT}`);
    console.log("✅ /health");
    console.log("✅ /saweria");
    console.log("✅ /cek");
    console.log("✅ /top");
    console.log("✅ /stats");
    console.log("========================================");
});
