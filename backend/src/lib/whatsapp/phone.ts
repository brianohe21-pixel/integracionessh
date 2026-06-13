import { z } from "zod";
import { normalizePhone } from "../dynamodb/contact.repository.js";

export const whatsappPhoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .transform((value) => normalizePhone(value))
  .pipe(
    z
      .string()
      .min(7, "Phone number is too short")
      .max(20, "Phone number is too long")
      .regex(/^\d+$/, "Phone number must contain only digits")
  );
