import { Notification } from "../models/index.js";

// GET /api/notifications — oxirgi bildirishnomalar va o'qilmaganlar soni (admin)
export async function list(req, res) {
  const me = req.user._id;
  const [items, unread] = await Promise.all([
    Notification.find().sort({ createdAt: -1 }).limit(30).populate("createdBy", "name").lean(),
    Notification.countDocuments({ readBy: { $ne: me } }),
  ]);
  res.json({
    success: true,
    unread,
    data: items.map(({ readBy, ...n }) => ({ ...n, read: (readBy || []).some((id) => String(id) === String(me)) })),
  });
}

// POST /api/notifications/read — hammasini o'qilgan deb belgilash
export async function readAll(req, res) {
  await Notification.updateMany({ readBy: { $ne: req.user._id } }, { $addToSet: { readBy: req.user._id } });
  res.json({ success: true });
}
