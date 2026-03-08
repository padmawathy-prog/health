const express = require('express');
const router = express.Router();
const EmergencyRequest = require('../models/EmergencyRequest');
const User = require('../models/User');
const auth = require('../middleware/auth');
const nodemailer = require('nodemailer');

// ── Email transporter (more reliable Gmail SMTP config) ──
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ── Send email to ONE specific donor ──
async function sendRequestEmailTodonor(request, donorEmail, donorName) {
  if (!donorEmail) return;

  try {

    const info = await transporter.sendMail({
      from: `"Health Tech Connect" <${process.env.EMAIL_USER}>`,
      to: donorEmail,
      subject: `🩸 Someone needs your blood – ${request.bloodRequired} at ${request.hospital}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden;">
          
          <div style="background:linear-gradient(90deg,#e53935,#ff1744);padding:1.5rem;text-align:center;">
            <h2 style="color:#fff;margin:0;">🩸 Blood Request Alert</h2>
          </div>

          <div style="padding:1.5rem;">

            <p style="color:#333;">Hi <strong>${donorName}</strong>,</p>
            <p style="color:#333;">
              Someone nearby needs your blood type. Please login and respond to the request.
            </p>

            <table style="width:100%;border-collapse:collapse;margin-top:1rem;">
              
              <tr style="background:#fff5f5;">
                <td style="padding:8px 12px;font-weight:700;color:#888;width:40%;">Patient</td>
                <td style="padding:8px 12px;color:#222;">${request.patientName}</td>
              </tr>

              <tr>
                <td style="padding:8px 12px;font-weight:700;color:#888;">Blood Group</td>
                <td style="padding:8px 12px;color:#e53935;font-weight:800;">
                  ${request.bloodRequired}
                </td>
              </tr>

              <tr style="background:#fff5f5;">
                <td style="padding:8px 12px;font-weight:700;color:#888;">Hospital</td>
                <td style="padding:8px 12px;color:#222;">${request.hospital}</td>
              </tr>

              <tr>
                <td style="padding:8px 12px;font-weight:700;color:#888;">Location</td>
                <td style="padding:8px 12px;color:#222;">${request.location}</td>
              </tr>

              <tr style="background:#fff5f5;">
                <td style="padding:8px 12px;font-weight:700;color:#888;">Urgency</td>
                <td style="padding:8px 12px;color:#222;">${request.urgency}</td>
              </tr>

              <tr>
                <td style="padding:8px 12px;font-weight:700;color:#888;">Contact</td>
                <td style="padding:8px 12px;color:#222;">${request.contact}</td>
              </tr>

            </table>

            <p style="margin-top:1.5rem;color:#888;font-size:0.88rem;">
              Login to Health Tech Connect → Request page to accept or reject this request.
            </p>

          </div>
        </div>
      `
    });

    console.log("✅ Email sent to:", donorEmail);
    console.log("📨 Gmail response:", info.response);

  } catch (err) {

    console.error("❌ Email sending failed:", err);

  }
}


// ── POST: Create blood request ──
router.post('/', auth, async (req, res) => {

  try {

    const {
      patientName,
      bloodRequired,
      hospital,
      location,
      urgency,
      contact,
      notes,
      targetDonorId,
      targetDonorEmail
    } = req.body;

    const request = new EmergencyRequest({
      patientName,
      bloodRequired,
      hospital,
      location,
      urgency,
      contact,
      notes,
      requestedBy: req.user.id,
      targetDonor: targetDonorId || null,
      status: 'pending'
    });

    await request.save();


    // Send email to donor
    if (targetDonorId && targetDonorEmail) {

      const donor = await User
        .findById(targetDonorId)
        .select('name');

      await sendRequestEmailTodonor(
        request,
        targetDonorEmail,
        donor?.name || "Donor"
      );

    }

    res.json({
      msg: "Blood request sent successfully!"
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      msg: "Server error. Try again."
    });

  }

});


// ── GET incoming requests ──
router.get('/incoming', auth, async (req, res) => {

  try {

    const user = await User.findById(req.user.id);

    if (!user)
      return res.status(404).json({ msg: "User not found." });

    if (!user.isAvailable)
      return res.json([]);

    const requests = await EmergencyRequest.find({
      targetDonor: req.user.id,
      status: { $in: ['pending', 'accepted'] }
    })
      .sort({ createdAt: -1 })
      .populate('requestedBy', 'name email');

    res.json(requests);

  } catch (err) {

    console.error(err);

    res.status(500).json({ msg: "Server error." });

  }

});


// ── GET requests created by user ──
router.get('/my-requests', auth, async (req, res) => {

  try {

    const requests = await EmergencyRequest
      .find({ requestedBy: req.user.id })
      .sort({ createdAt: -1 });

    res.json(requests);

  } catch (err) {

    res.status(500).json({ msg: "Server error." });

  }

});


// ── GET donations by user ──
router.get('/my-donations', auth, async (req, res) => {

  try {

    const donations = await EmergencyRequest.find({
      acceptedBy: req.user.id,
      status: "donated"
    })
      .sort({ updatedAt: -1 })
      .populate("requestedBy", "name");

    res.json(donations);

  } catch (err) {

    res.status(500).json({ msg: "Server error." });

  }

});


// ── PATCH request status ──
router.patch('/:id/status', auth, async (req, res) => {

  try {

    const { status } = req.body;

    const request = await EmergencyRequest
      .findById(req.params.id);

    if (!request)
      return res.status(404).json({ msg: "Request not found." });

    if (status === "accepted") {

      request.status = "accepted";
      request.acceptedBy = req.user.id;

    }

    else if (status === "donated") {

      if (String(request.acceptedBy) !== String(req.user.id))
        return res.status(403).json({
          msg: "Only the accepting donor can mark as donated."
        });

      request.status = "donated";

    }

    else if (status === "rejected") {

      request.status = "rejected";

    }

    else {

      return res.status(400).json({
        msg: "Invalid status."
      });

    }

    await request.save();

    res.json({
      msg: `Request marked as ${status}.`,
      request
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({ msg: "Server error." });

  }

});

module.exports = router;