const express = require("express");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        status: "online",
        message: "Saweria KALCERLOUNGE Railway Online"
    });
});

app.get("/health", (req, res) => {
    res.json({
        status: "ok"
    });
});

app.post("/saweria", async (req, res) => {
    try {
        console.log("Data Saweria diterima:");
        console.log(req.body);

        const googleScriptUrl = process.env.GOOGLE_SCRIPT_URL;

        if (!googleScriptUrl) {
            return res.status(500).json({
                success: false,
                message: "GOOGLE_SCRIPT_URL belum diatur"
            });
        }

        const response = await fetch(googleScriptUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(req.body)
        });

        const result = await response.text();

        console.log("Response Google Script:");
        console.log(result);

        res.json({
            success: true,
            message: "Data diteruskan ke Google Script",
            googleResponse: result
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            error: error.toString()
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server berjalan di port ${PORT}`);
});
