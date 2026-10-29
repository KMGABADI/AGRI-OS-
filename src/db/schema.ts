import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, boolean, decimal } from 'drizzle-orm/pg-core';

// Define the 'users' table (system users)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: text('role').default('Field Agent'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Define the 'farmers' table
export const farmers = pgTable('farmers', {
  id: serial('id').primaryKey(),
  farmerID: text('farmer_id').notNull().unique(),
  title: text('title'),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  gender: text('gender'),
  primaryPhone: text('primary_phone'),
  state: text('state'),
  lga: text('lga'),
  crop: text('crop'),
  farmSize: decimal('farm_size'),
  kycComplete: boolean('kyc_complete').default(false),
  creditScore: integer('credit_score'),
  latitude: decimal('latitude'),
  longitude: decimal('longitude'),
  profileStatus: text('profile_status').default('Active'),
  photo: text('photo'),
  registrationDate: timestamp('registration_date').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});
