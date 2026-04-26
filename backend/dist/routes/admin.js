"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const auth_1 = require("../middleware/auth");
const express_validator_1 = require("express-validator");
const router = (0, express_1.Router)();
exports.adminRouter = router;
router.use(auth_1.authenticate);
router.use((0, auth_1.requireRole)('ADMIN'));
// GET /api/v1/admin/users
router.get('/users', async (_req, res) => {
    try {
        const users = await prisma_1.default.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                staffId: true,
                name: true,
                role: true,
                zone: true,
                region: true,
                territory: true,
                active: true,
                createdAt: true,
                asTeamLead: { select: { id: true, aseId: true, allocatedTarget: true } },
            },
        });
        res.json({ success: true, data: users });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
// POST /api/v1/admin/users
router.post('/users', [
    (0, express_validator_1.body)('staffId').notEmpty(),
    (0, express_validator_1.body)('pin').isLength({ min: 4, max: 4 }),
    (0, express_validator_1.body)('name').notEmpty(),
    (0, express_validator_1.body)('role').isIn(['HSD', 'ZBM', 'ASE', 'TL', 'ADMIN']),
], async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ success: false, error: errors.array()[0].msg });
        return;
    }
    try {
        const { staffId, pin, name, role, zone, region, territory, aseId } = req.body;
        const existing = await prisma_1.default.user.findUnique({ where: { staffId } });
        if (existing) {
            res.status(409).json({ success: false, error: 'Staff ID already exists' });
            return;
        }
        const pinHash = await bcryptjs_1.default.hash(pin, 10);
        const user = await prisma_1.default.user.create({
            data: {
                staffId,
                pinHash,
                name,
                role: role,
                zone: zone || null,
                region: region || null,
                territory: territory || null,
            },
        });
        // Create TeamLead record if role is TL
        if (role === 'TL') {
            await prisma_1.default.teamLead.create({
                data: {
                    userId: user.id,
                    aseId: aseId || null,
                    zone: zone || null,
                    region: region || null,
                },
            });
        }
        res.status(201).json({
            success: true,
            data: { id: user.id, staffId: user.staffId, name: user.name, role: user.role },
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
// PATCH /api/v1/admin/users/:id
router.patch('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, zone, region, territory, active, pin } = req.body;
        const user = await prisma_1.default.user.findUnique({ where: { id } });
        if (!user) {
            res.status(404).json({ success: false, error: 'User not found' });
            return;
        }
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (zone !== undefined)
            updateData.zone = zone;
        if (region !== undefined)
            updateData.region = region;
        if (territory !== undefined)
            updateData.territory = territory;
        if (active !== undefined)
            updateData.active = active;
        if (pin)
            updateData.pinHash = await bcryptjs_1.default.hash(pin, 10);
        const updated = await prisma_1.default.user.update({ where: { id }, data: updateData });
        res.json({
            success: true,
            data: { id: updated.id, staffId: updated.staffId, name: updated.name, active: updated.active },
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
// DELETE /api/v1/admin/users/:id
router.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma_1.default.user.update({ where: { id }, data: { active: false } });
        res.json({ success: true, data: { message: 'User deactivated' } });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
//# sourceMappingURL=admin.js.map