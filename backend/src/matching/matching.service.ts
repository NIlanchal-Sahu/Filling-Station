import { Injectable } from '@nestjs/common';

export interface MatchInput {
  studentSkills: string[];
  studentEducation?: string | null;
  studentExperience?: unknown;
  studentLat?: number | null;
  studentLng?: number | null;
  jobSkills: string[];
  jobEducation?: string | null;
  jobExperience?: string | null;
  jobLat?: number | null;
  jobLng?: number | null;
}

@Injectable()
export class MatchingService {
  calculateMatchScore(input: MatchInput): number {
    const skillsScore = this.skillsOverlap(input.studentSkills, input.jobSkills);
    const educationScore = this.educationMatch(input.studentEducation, input.jobEducation);
    const experienceScore = this.experienceMatch(input.studentExperience, input.jobExperience);
    const locationScore = this.locationScore(
      input.studentLat,
      input.studentLng,
      input.jobLat,
      input.jobLng,
    );

    const weighted =
      skillsScore * 0.4 + educationScore * 0.2 + experienceScore * 0.2 + locationScore * 0.2;

    return Math.round(Math.min(100, Math.max(0, weighted)));
  }

  private skillsOverlap(studentSkills: string[], jobSkills: string[]): number {
    if (!jobSkills.length) return 80;
    if (!studentSkills.length) return 0;

    const normalizedStudent = studentSkills.map((s) => s.toLowerCase().trim());
    const normalizedJob = jobSkills.map((s) => s.toLowerCase().trim());
    const matches = normalizedJob.filter((skill) =>
      normalizedStudent.some((s) => s.includes(skill) || skill.includes(s)),
    );

    return (matches.length / normalizedJob.length) * 100;
  }

  private educationMatch(studentEd?: string | null, jobEd?: string | null): number {
    if (!jobEd) return 100;
    if (!studentEd) return 30;
    const s = studentEd.toLowerCase();
    const j = jobEd.toLowerCase();
    if (s.includes(j) || j.includes(s)) return 100;
    return 50;
  }

  private experienceMatch(studentExp?: unknown, jobExp?: string | null): number {
    if (!jobExp) return 100;
    if (!studentExp) return jobExp.toLowerCase().includes('fresher') ? 100 : 20;

    const expArray = Array.isArray(studentExp) ? studentExp : [];
    const totalYears = expArray.reduce((sum: number, e: { years?: number }) => sum + (e.years || 0), 0);
    const required = parseInt(jobExp.match(/\d+/)?.[0] || '0', 10);

    if (required === 0) return 100;
    if (totalYears >= required) return 100;
    return Math.max(0, (totalYears / required) * 100);
  }

  private locationScore(
    sLat?: number | null,
    sLng?: number | null,
    jLat?: number | null,
    jLng?: number | null,
  ): number {
    if (!sLat || !sLng || !jLat || !jLng) return 60;

    const R = 6371;
    const dLat = ((jLat - sLat) * Math.PI) / 180;
    const dLon = ((jLng - sLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((sLat * Math.PI) / 180) * Math.cos((jLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    if (km <= 5) return 100;
    if (km <= 15) return 85;
    if (km <= 30) return 70;
    if (km <= 50) return 50;
    return 25;
  }
}
