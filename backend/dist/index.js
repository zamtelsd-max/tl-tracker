"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = require("./routes/auth");
const tl_1 = require("./routes/tl");
const ase_1 = require("./routes/ase");
const zbm_1 = require("./routes/zbm");
const hsd_1 = require("./routes/hsd");
const admin_1 = require("./routes/admin");
const alerts_1 = require("./services/alerts");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3002;
// Middleware
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Health check
app.get('/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});
// Routes
app.use('/api/v1/auth', auth_1.authRouter);
app.use('/api/v1/tl', tl_1.tlRouter);
app.use('/api/v1/ase', ase_1.aseRouter);
app.use('/api/v1/zbm', zbm_1.zbmRouter);
app.use('/api/v1/hsd', hsd_1.hsdRouter);
app.use('/api/v1/admin', admin_1.adminRouter);
// 404 handler
app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
});
// Error handler
app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, error: 'Internal server error' });
});
// Start server
app.listen(PORT, () => {
    console.log(`TL Tracker API running on port ${PORT}`);
    (0, alerts_1.startAlertCron)();
});
exports.default = app;
//# sourceMappingURL=index.js.map