# MeetingRAG - Meeting Intelligence Assistant

A full-stack web application that enables users to upload meeting recordings and ask intelligent questions about them using a Chat UI. Built with React frontend and Node.js/Express backend with MongoDB persistence.

## Features

- **Email-based OTP Authentication** - Secure login via one-time passwords
- **Meeting Upload** - Upload meeting files (MP4, WAV) with participant information
- **Chat Interface** - Ask questions about uploaded meetings
- **Real-time Notifications** - Get email notifications for meetings
- **Persistent Storage** - All meetings and user data stored in MongoDB
- **Production-Ready** - Error handling, validation, CORS, rate limiting

## Project Structure

```
MeetingRAG/
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   │   ├── Login.js
│   │   │   ├── OTPVerify.js
│   │   │   ├── ChatUI.js
│   │   │   ├── Sidebar.js
│   │   │   ├── UploadMeeting.js
│   │   │   └── [CSS files]
│   │   ├── pages/
│   │   │   └── Dashboard.js
│   │   ├── services/
│   │   │   └── api.js       # Axios configuration with Bearer auth
│   │   ├── App.js
│   │   └── index.js
│   ├── package.json
│   └── .env
│
└── backend/                  # Express.js API
    ├── models/              # MongoDB schemas
    │   ├── User.js
    │   └── Meeting.js
    ├── routes/              # API endpoints
    │   ├── auth.js         # OTP login endpoints
    │   └── meeting.js      # Meeting management endpoints
    ├── controllers/         # Business logic
    │   ├── authController.js
    │   └── meetingController.js
    ├── middleware/
    │   └── auth.js         # JWT verification
    ├── config/
    │   ├── mongodb.js
    │   └── email.js
    ├── uploads/            # Meeting file storage
    ├── server.js
    ├── package.json
    ├── .env
    └── README.md
```

## Quick Start

### Prerequisites
- Node.js (v14+)
- npm or yarn
- MongoDB (local or MongoDB Atlas)
- Gmail account (for OTP emails) or compatible email service

### 1. Clone & Setup

```bash
# Clone the repository (if applicable)
git clone <repo-url>
cd MeetingRAG

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

### 2. Configure Environment Variables

**Backend (.env)**
```bash
cd backend

# Copy .env.example to .env
cp .env.example .env

# Edit .env with your values:
# - MONGODB_URI (local or MongoDB Atlas)
# - EMAIL_USER and EMAIL_PASSWORD (Gmail app password)
# - JWT_SECRET (any secure string)
```

**Frontend (.env)**
```bash
cd ../frontend

# Already configured with REACT_APP_API_URL=http://localhost:5000
# Modify if backend runs on different port
```

### 3. Setup Email Service (Gmail)

1. Go to [Gmail App Passwords](https://myaccount.google.com/apppasswords)
2. Select "Mail" and "Windows Computer"
3. Generate app password → 16 character password
4. Paste into backend `.env` as `EMAIL_PASSWORD`

### 4. Setup MongoDB

**Option A: Local MongoDB**
```bash
# Install MongoDB
# Default: mongodb://localhost:27017/meeting-rag
```

**Option B: MongoDB Atlas (Recommended)**
1. Create free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create cluster → Get connection string
3. Update `MONGODB_URI` in backend `.env`

### 5. Start Servers

**Terminal 1 - Backend**
```bash
cd backend
npm run dev
# Runs on http://localhost:5000
```

**Terminal 2 - Frontend**
```bash
cd frontend
npm start
# Runs on http://localhost:3000
```

## User Flow

1. **Login** → User enters email → Backend sends OTP via Gmail
2. **OTP Verification** → User enters OTP → Backend generates JWT token
3. **Dashboard** → User sees Chat UI and Sidebar
4. **Upload Meeting** → User clicks "Upload Meeting" → Upload file + add participants
5. **Query** → User asks questions → Backend returns answers (placeholder for RAG)

## API Endpoints

### Authentication
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/send-otp` | `{ email }` | OTP sent |
| POST | `/verify-otp` | `{ email, otp }` | `{ token }` |

### Meetings (Requires Bearer token)
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/upload-meeting` | FormData: `file`, `meetingName`, `participants` | Meeting created |
| POST | `/query` | `{ query }` | `{ answer }` |
| GET | `/meetings` | - | List of meetings |

## Testing the Application

### Test OTP Flow
```bash
# 1. Go to http://localhost:3000
# 2. Enter your email
# 3. Check Gmail inbox for OTP
# 4. Enter OTP to verify
# 5. Should be logged in to Dashboard
```

### Test Meeting Upload
```bash
# 1. Click "Upload Meeting"
# 2. Enter meeting name
# 3. Upload a file (mp4/wav)
# 4. Add participant emails
# 5. Click Upload
# 6. Should see success message
```

### Test Chat Query
```bash
# 1. Type a message in Chat UI
# 2. Click Send
# 3. Should receive response from backend
```

## Development

### Enable Development Email Logging
In `backend/controllers/authController.js`, OTP codes are logged to console in development mode:
```
[DEV] OTP for user@example.com: 123456
Use this for testing without email setup
```

### Troubleshooting

**MongoDB Connection Failed**
- Check if MongoDB is running: `mongod`
- Verify `MONGODB_URI` format
- Check firewall/VPN blocks

**Email Not Sending**
- Verify Gmail app password (not regular password)
- Check `EMAIL_USER` and `EMAIL_PASSWORD` in `.env`
- Enable "Less secure app access" or use App Passwords

**CORS Errors**
- Ensure `CORS_ORIGIN=http://localhost:3000` in backend `.env`
- Frontend and backend running on correct ports

**Port Already in Use**
```bash
# Find process using port 5000
netstat -ano | findstr :5000

# Kill process
taskkill /PID <PID> /F
```

## MongoDB Schema

### User Collection
```json
{
  "_id": ObjectId,
  "email": "user@example.com",
  "isVerified": true,
  "otp": {
    "code": null,
    "expiresAt": null
  },
  "meetings": [ObjectId],
  "createdAt": ISODate,
  "updatedAt": ISODate
}
```

### Meeting Collection
```json
{
  "_id": ObjectId,
  "meeting_id": "M12345678",
  "meeting_name": "Salary Discussion",
  "file_path": "/uploads/meeting.mp4",
  "file_name": "meeting.mp4",
  "file_size": 52428800,
  "participants": [
    {
      "email": "user1@company.com",
      "id": "uuid-123"
    }
  ],
  "created_by": ObjectId,
  "createdAt": ISODate,
  "updatedAt": ISODate
}
```

## Security

- **JWT Authentication** - 7-day expiry
- **Email OTP** - 10-minute expiry, 1-minute rate limit
- **Password Validation** - Email format checking
- **File Upload Validation** - Type and size limits
- **CORS Protection** - Whitelist frontend origin
- **Error Handling** - Generic error messages to prevent info leakage

## Production Deployment

### Frontend (Vercel, Netlify)
```bash
npm run build
# Deploy build/ folder
```

### Backend (Heroku, Railway, Render)
```bash
# Set environment variables in hosting platform
# Push code to git → Auto-deploy
```

## Dependencies

**Frontend**
- React 19
- Axios
- React Router
- UUID

**Backend**
- Express.js
- Mongoose
- JWT
- Multer (file uploads)
- Nodemailer (emails)

## License

ISC

---

For detailed backend setup, see [backend/README.md](backend/README.md)
