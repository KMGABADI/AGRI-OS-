import { z } from 'zod';

export const farmerSchema = z.object({
  title: z.string().optional(),
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  gender: z.string().optional(),
  primaryPhone: z.string().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number"),
  country: z.string().min(2, "Country is required").optional(),
  state: z.string().min(2, "State/Region is required"),
  lga: z.string().min(2, "LGA/Department is required"),
  organizationId: z.string().optional(),
  programId: z.string().optional(),
  latitude: z.union([z.number(), z.string().transform(v => parseFloat(v) || 0)]).optional(),
  longitude: z.union([z.number(), z.string().transform(v => parseFloat(v) || 0)]).optional(),
  bvn: z.string().optional(),
  nin: z.string().optional(),
  farmSize: z.union([z.number(), z.string().transform(v => parseFloat(v) || 0)]).optional(),
  experience: z.union([z.number(), z.string().transform(v => parseInt(v, 10) || 0)]).optional(),
});

export const validateFarmer = (data: any) => {
  return farmerSchema.safeParse(data);
};
