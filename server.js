const express = require("express");
const crypto = require("crypto");

const app = express();

app.use(express.json({ limit: "1mb" }));

// ======================================================
// DATABASE SEMENTARA
// ======================================================

// Donasi yang belum diambil Roblox
const pendingDonations = [];

// Semua donasi yang sudah diterima
const donationHistory = [];

// ID/fingerprint donasi yang sudah pernah diterima
const processedDonations = new Set();

// Batas penyimpanan history di RAM
const MAX_HISTORY = 10000;


// ======================================================
// HELPER
// ======================================================

function getDonationName(data) {
    return (
        data.nama ||
        data.donor_name ||
        data.donator_name ||
        data.name ||
        data.username ||
        "Anonymous"
    );
}

function getDonationAmount(data) {
    const amount =
        data.jumlah ??
        data.amount ??
        data.amount_raw ??
        data.total ??
        data.value ??
        0;

    if (typeof amount === "number") {
        return amount;
    }

    if (typeof amount === "string") {
        // Hilangkan Rp, titik, koma, spasi, dll.
        const cleaned = amount.replace(/[^\d]/g, "");
        return Number(cleaned) || 0;
    }

    return 0;
}

function getDonationMessage(data) {
    return (
        data.pesan ??
        data.message ??
        data.comment ??
        data.note ??
        ""
    );
}

function getRobloxUsername(data) {
    return (
        data.robloxUsername ||
        data.roblox_username ||
        data.robloxUser ||
        data.roblox_user ||
        data.custom_data?.robloxUsername ||
        data.custom_data?.roblox_username ||
        ""
    );
}


// ======================================================
// ANTI DUPLIKAT
// ======================================================

function getDonationId(data) {
    const possibleId =
        data.id ||
        data.donation_id ||
        data.donationId ||
        data.transaction_id ||
        data.transactionId ||
        data.uuid ||
        data.reference;

    if (possibleId) {
        return String(possibleId);
    }

    // Kalau Saweria tidak memberikan ID,
    // buat fingerprint berdasarkan isi donasi.
    const fingerprintData = JSON.stringify({
        nama: getDonationName(data),
        jumlah: getDonationAmount(data),
        pesan: getDonationMessage(data),
        robloxUsername: getRobloxUsername(data),
        created_at:
            data.created_at ||
            data.createdAt ||
            data.timestamp ||
            ""
    });

    return crypto
        .createHash("sha256")
        .update(fingerprintData)
        .digest("hex");
}


// ======================================================
// FORMAT DATA DONASI
// ======================================================

function normalizeDonation(data) {
    const nama = getDonationName(data);
    const jumlah = getDonationAmount(data);
    const pesan = getDonationMessage(data);
    const robloxUsername = getRobloxUsername(data);

    return {
        id: getDonationId(data),

        nama: nama,

        jumlah: jumlah,

        pesan: pesan,

        robloxUsername: robloxUsername,

        formatted:
            "Rp " +
            Number(jumlah).toLocaleString("id-ID"),

        timestamp: new Date().toISOString()
    };
}


// ======================================================
// ROOT
// ======================================================

app.get("/", (req, res) => {
    res.json({
        status: "online",
        message: "Saweria KALCERLOUNGE Railway Online",
        endpoints: {
            cek: "/cek",
            top: "/top",
            stats: "/stats",
            health: "/health"
        }
    });
});


// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        pending: pendingDonations.length,
        history: donationHistory.length
    });
});


// ======================================================
// SAWERIA WEBHOOK
// ======================================================

app.post("/saweria", (req, res) => {
    try {
        console.log("=================================");
        console.log("Data Saweria diterima:");
        console.log(JSON.stringify(req.body, null, 2));
        console.log("=================================");

        const donation = normalizeDonation(req.body);

        // Validasi nominal
        if (donation.jumlah <= 0) {
            console.log("Donasi ditolak: jumlah tidak valid");

            return res.status(400).json({
                success: false,
                message: "Jumlah donasi tidak valid"
            });
        }

        // ==================================================
        // CEK DUPLIKAT
        // ==================================================

        if (processedDonations.has(donation.id)) {
            console.log(
                "Donasi duplikat diabaikan:",
                donation.id
            );

            return res.json({
                success: true,
                duplicate: true,
                message: "Donasi sudah pernah diterima"
            });
        }

        // Tandai sudah diproses
        processedDonations.add(donation.id);

        // ==================================================
        // MASUK HISTORY
        // ==================================================

        donationHistory.push(donation);

        // Batasi history
        if (donationHistory.length > MAX_HISTORY) {
            donationHistory.shift();
        }

        // ==================================================
        // MASUK QUEUE ROBLOX
        // ==================================================

        pendingDonations.push(donation);

        console.log("DONASI BERHASIL DISIMPAN");
        console.log({
            nama: donation.nama,
            jumlah: donation.jumlah,
            pesan: donation.pesan,
            robloxUsername: donation.robloxUsername
        });

        console.log(
            "Pending:",
            pendingDonations.length
        );

        console.log(
            "History:",
            donationHistory.length
        );

        // ==================================================
        // RESPONSE
        // ==================================================

        return res.json({
            success: true,
            message: "Donasi berhasil diterima",
            donation: {
                nama: donation.nama,
                jumlah: donation.jumlah,
                pesan: donation.pesan,
                robloxUsername: donation.robloxUsername
            }
        });

    } catch (error) {
        console.error("ERROR /saweria:");
        console.error(error);

        return res.status(500).json({
            success: false,
            error: error.toString()
        });
    }
});


// ======================================================
// CEK DONASI BARU
// ======================================================
// Roblox akan memanggil endpoint ini.
//
// Contoh:
// GET /cek
//
// Setelah donasi diberikan ke Roblox,
// donasi dihapus dari pending queue.
//
// Tetapi TIDAK dihapus dari history.
// ======================================================

app.get("/cek", (req, res) => {
    try {
        // Salin semua donasi pending
        const donations = [...pendingDonations];

        // Kosongkan queue
        pendingDonations.length = 0;

        console.log(
            `Roblox mengambil ${donations.length} donasi`
        );

        return res.json(donations);

    } catch (error) {
        console.error("ERROR /cek:");
        console.error(error);

        return res.status(500).json({
            success: false,
            error: error.toString()
        });
    }
});


// ======================================================
// TOP DONATUR
// ======================================================
// Mengambil seluruh history,
// lalu menggabungkan berdasarkan Roblox Username.
// ======================================================

app.get("/top", (req, res) => {
    try {
        const leaderboard = {};

        for (const donation of donationHistory) {

            // Prioritas username Roblox
            // Jika kosong gunakan nama Saweria
            const key =
                donation.robloxUsername &&
                donation.robloxUsername.trim() !== ""
                    ? donation.robloxUsername.trim().toLowerCase()
                    : donation.nama.trim().toLowerCase();

            if (!leaderboard[key]) {
                leaderboard[key] = {
                    robloxUsername:
                        donation.robloxUsername ||
                        donation.nama,

                    nama: donation.nama,

                    total: 0,

                    count: 0
                };
            }

            leaderboard[key].total +=
                Number(donation.jumlah) || 0;

            leaderboard[key].count++;
        }

        // Ubah object menjadi array
        const result = Object.values(leaderboard);

        // Urutkan berdasarkan total terbesar
        result.sort((a, b) => b.total - a.total);

        return res.json(result);

    } catch (error) {
        console.error("ERROR /top:");
        console.error(error);

        return res.status(500).json({
            success: false,
            error: error.toString()
        });
    }
});


// ======================================================
// STATISTIK
// ======================================================

app.get("/stats", (req, res) => {
    try {

        // Total semua uang donasi
        const totalDonasi = donationHistory.reduce(
            (total, donation) => {
                return total + (Number(donation.jumlah) || 0);
            },
            0
        );

        // Donatur unik
        const uniqueDonors = new Set();

        for (const donation of donationHistory) {

            const key =
                donation.robloxUsername &&
                donation.robloxUsername.trim() !== ""
                    ? donation.robloxUsername.trim().toLowerCase()
                    : donation.nama.trim().toLowerCase();

            uniqueDonors.add(key);
        }

        return res.json({
            totalDonasi: totalDonasi,
            totalDonatur: uniqueDonors.size
        });

    } catch (error) {
        console.error("ERROR /stats:");
        console.error(error);

        return res.status(500).json({
            success: false,
            error: error.toString()
        });
    }
});


// ======================================================
// DEBUG - MELIHAT DATA PENDING
// ======================================================

app.get("/debug", (req, res) => {
    res.json({
        pending: pendingDonations,
        pendingCount: pendingDonations.length,
        historyCount: donationHistory.length
    });
});


// ======================================================
// SERVER
// ======================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log("=================================");
    console.log("SAWERIA KALCERLOUNGE ONLINE");
    console.log("Port:", PORT);
    console.log("=================================");
});
