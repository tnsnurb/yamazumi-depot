import { z } from "zod";

export const WheelMeasureSchema = z.object({
    axle_number: z.number().min(1).max(6),
    side: z.enum(['Left', 'Right']),
    tire_thickness: z.number().optional(),
    wear: z.number().optional(),
    flange_thickness: z.number().optional(),
    flange_steepness: z.number().optional(), // Also known as Qp
    diameter: z.number().optional(),
});

export type WheelMeasure = z.infer<typeof WheelMeasureSchema>;

export type Status = 'ok' | 'warning' | 'error' | 'none';

export interface ValidationResult {
    overallStatus: Status;
    fields: {
        tire_thickness: Status;
        wear: Status;
        flange_thickness: Status;
        flange_steepness: Status;
        diameter: Status;
    };
}

export const LIMITS = {
    tire_thickness: { min: 45, warning: 50 },
    wear: { max: 7, warning: 5 },
    flange_thickness: { min: 25, max: 33, warning_low: 26, warning_high: 32 },
    flange_steepness: { min: 6.5, warning: 7 },
    diameter: { min: 1050, warning: 1060 } // Placeholder: 1048.5 in screenshot is critical
};

export function validateWheelMeasures(data: WheelMeasure): ValidationResult {
    const fields: ValidationResult['fields'] = {
        tire_thickness: 'none',
        wear: 'none',
        flange_thickness: 'none',
        flange_steepness: 'none',
        diameter: 'none',
    };

    // Tire Thickness
    if (data.tire_thickness !== undefined) {
        if (data.tire_thickness <= LIMITS.tire_thickness.min) fields.tire_thickness = 'error';
        else if (data.tire_thickness < LIMITS.tire_thickness.warning) fields.tire_thickness = 'warning';
        else fields.tire_thickness = 'ok';
    }

    // Wear (Прокат)
    if (data.wear !== undefined) {
        if (data.wear >= LIMITS.wear.max) fields.wear = 'error';
        else if (data.wear >= LIMITS.wear.warning) fields.wear = 'warning';
        else fields.wear = 'ok';
    }

    // Flange Thickness
    if (data.flange_thickness !== undefined) {
        if (data.flange_thickness < LIMITS.flange_thickness.min || data.flange_thickness > LIMITS.flange_thickness.max) {
            fields.flange_thickness = 'error';
        } else if (data.flange_thickness < LIMITS.flange_thickness.warning_low || data.flange_thickness > LIMITS.flange_thickness.warning_high) {
            fields.flange_thickness = 'warning';
        } else {
            fields.flange_thickness = 'ok';
        }
    }

    // Flange Steepness (Qp / Крутизна гребня)
    if (data.flange_steepness !== undefined) {
        if (data.flange_steepness <= LIMITS.flange_steepness.min) fields.flange_steepness = 'error';
        else if (data.flange_steepness < LIMITS.flange_steepness.warning) fields.flange_steepness = 'warning';
        else fields.flange_steepness = 'ok';
    }

    // Diameter
    if (data.diameter !== undefined) {
        if (data.diameter <= LIMITS.diameter.min) fields.diameter = 'error';
        else if (data.diameter < LIMITS.diameter.warning) fields.diameter = 'warning';
        else fields.diameter = 'ok';
    }

    // Calculate Overall Status
    const fieldStatuses = Object.values(fields);
    let overallStatus: Status = 'none';

    if (fieldStatuses.includes('error')) {
        overallStatus = 'error';
    } else if (fieldStatuses.includes('warning')) {
        overallStatus = 'warning';
    } else if (fieldStatuses.includes('ok')) {
        overallStatus = 'ok';
    }

    return { overallStatus, fields };
}
