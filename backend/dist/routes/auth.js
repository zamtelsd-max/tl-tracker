"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const express_validator_1 = require("express-validator");
const router = (0, express_1.Router)();
exports.authRouter = router;
router.post('/login', [
    (0, express_validator_1.body)('staffId').notEmpty().withMessage('Staff ID required'),
    (0, express_validator_1.body)('pin').isLength({ min: 4, max: 4 }).withMessage('PIN must be 4 digits'),
], async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ success: false, error: errors.array()[0].msg });
        return;
    }
    const { staffId, pin } = req.body;
    try {
        const user = await prisma_1.default.user.findUnique({ where: { staffId } });
        if (!user || !user.active) {
            res.status(401).json({ success: false, error: 'Invalid credentials' });
            return;
        }
        const pinMatch = await bcryptjs_1.default.compare(pin, user.pinHash);
        if (!pinMatch) {
            res.status(401).json({ success: false, error: 'Invalid credentials' });
            return;
        }
        // Get teamLeadId if TL
        let teamLeadId;
        if (user.role === 'TL') {
            const tl = await prisma_1.default.teamLead.findUnique({ where: { userId: user.id } });
            teamLeadId = tl?.id;
        }
        const secret = process.env.JWT_SECRET || 'tl-tracker-jwt-secret-2024';
        const token = jsonwebtoken_1.default.sign({ userId: user.id, staffId: user.staffId, role: user.role, teamLeadId }, secret, { expiresIn: '24h' });
        // Record login event (fire-and-forget)
        prisma_1.default.loginLog.create({
            data: { userId: user.id, userName: user.name, role: user.role, zone: user.zone },
        }).catch(() => { });
        res.json({
            success: true,
            data: {
                token,
                user: {
                    id: user.id,
                    staffId: user.staffId,
                    name: user.name,
                    role: user.role,
                    zone: user.zone,
                    region: user.region,
                    teamLeadId,
                },
            },
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
//# sourceMappingURL=auth.js.map