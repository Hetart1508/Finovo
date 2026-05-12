PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    daily_threshold REAL DEFAULT 1000
  );
INSERT INTO users VALUES(1,'hetarth@gmail.com','$2b$10$CdoNPtrx78ubHrCuDNr7F.yr7kdW686nLJhIheANoLMMCBNVb0kpG','Hetarth Bhavsar',1000.0);
INSERT INTO users VALUES(2,'hetarthbhavsar68@gmail.com','$2b$10$1I7FRBRoRnNgdqCZQQuUN.lD11eP7nfOiZQMfRUH3/5FJlhVjvQi.','Hetarth ',1000.0);
INSERT INTO users VALUES(3,'hetarth150804@gmail.com','$2b$10$pIw7EZfhhK1poiW.2ezHJ.41wENqAv2/uhchnXChMhF/Hj.dexHIW','Hetarth',1000.0);
INSERT INTO users VALUES(4,'hetarthbhavsar830@gmail.com','$2b$10$K9IOY/017.0woSnyOi5kV..SxScjbGsTvHKfYgOIpB4j4o5OHQNt6','Hetarth Bhavsar',1000.0);
INSERT INTO users VALUES(5,'iuhiqwuw@gmail.com','$2b$10$EdVMkAyig4CJjwS7z/h67OaLVubGjSTNMhPQUeEVWDkY/3ScvQMCq','hiwqhw',1000.0);
INSERT INTO users VALUES(6,'hetarth123@gmail.com','$2b$10$6acvq0osOB4g7CvHlSUWjOwX.uyEcPnY//P4ANn1t7dX3r.EpkDWu','Hetarth Bhavsar ',1000.0);
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL, -- 'expense' or 'income'
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    payment_mode TEXT NOT NULL,
    description TEXT,
    bill_url TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
INSERT INTO transactions VALUES(1,1,122.0,'expense','Food','2026-04-15','UPI','',NULL);
INSERT INTO transactions VALUES(2,1,2522.0,'expense','Shopping','2024-02-09','UPI','AI Extracted: Fresh Express',NULL);
INSERT INTO transactions VALUES(3,1,220.0,'expense','Other','2020-02-01','UPI','AI Extracted: Brand Name',NULL);
INSERT INTO transactions VALUES(4,1,105200.0,'expense','Shopping','2025-04-22','UPI','AI Extracted: Add Company Name',NULL);
INSERT INTO transactions VALUES(5,3,10000.0,'expense','Shopping','2026-04-20','Cash','Clothes Shopping for Family',NULL);
INSERT INTO transactions VALUES(6,3,30000.0,'income','Entertainment','2026-04-21','UPI','',NULL);
CREATE TABLE recurring_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    day_of_month INTEGER NOT NULL,
    category TEXT NOT NULL,
    type TEXT NOT NULL, -- 'rent', 'sip', 'festival', etc.
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
CREATE TABLE otps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    otp TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(email)
  );
INSERT INTO sqlite_sequence VALUES('users',6);
INSERT INTO sqlite_sequence VALUES('transactions',6);
INSERT INTO sqlite_sequence VALUES('otps',24);
COMMIT;
