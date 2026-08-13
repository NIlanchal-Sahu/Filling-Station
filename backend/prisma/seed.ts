import { PrismaClient, UserRole, JobType, WorkMode, ApplicationStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('Password123!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@localjob.app' },
    update: {},
    create: {
      email: 'admin@localjob.app',
      passwordHash,
      role: UserRole.ADMIN,
      emailVerified: true,
      subscription: { create: { plan: 'FREE' } },
    },
  });

  const employerUser = await prisma.user.upsert({
    where: { email: 'employer@demo.com' },
    update: {
      avatarUrl: 'https://ui-avatars.com/api/?name=Raj+Sharma&background=0A66C2&color=fff&size=256',
    },
    create: {
      email: 'employer@demo.com',
      passwordHash,
      role: UserRole.EMPLOYER,
      emailVerified: true,
      phone: '+919876543210',
      phoneVerified: true,
      avatarUrl: 'https://ui-avatars.com/api/?name=Raj+Sharma&background=0A66C2&color=fff&size=256',
      subscription: { create: { plan: 'PREMIUM_EMPLOYER', jobPostsRemaining: 999 } },
      employerProfile: {
        create: {
          businessName: 'FreshBite Cafe',
          ownerName: 'Raj Sharma',
          category: 'Food & Beverage',
          description: 'Popular local cafe serving fresh coffee, snacks, and meals. We hire students for part-time serving, kitchen help, and social media roles.',
          logoUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200&h=200&fit=crop',
          photos: [
            'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=800&h=400&fit=crop',
            'https://images.unsplash.com/photo-1495474472287-4d713bcdd022?w=400&h=300&fit=crop',
            'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=300&fit=crop',
          ],
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          address: '123 Linking Road, Bandra',
          companySize: '10-50',
          isVerified: true,
          verificationBadge: true,
          latitude: 19.0596,
          longitude: 72.8295,
          website: 'https://freshbite.example.com',
        },
      },
    },
    include: { employerProfile: true },
  });

  // Refresh demo employer images if profile already existed
  if (employerUser.employerProfile) {
    await prisma.employerProfile.update({
      where: { id: employerUser.employerProfile.id },
      data: {
        logoUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200&h=200&fit=crop',
        photos: [
          'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=800&h=400&fit=crop',
          'https://images.unsplash.com/photo-1495474472287-4d713bcdd022?w=400&h=300&fit=crop',
          'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=300&fit=crop',
        ],
        description: 'Popular local cafe serving fresh coffee, snacks, and meals. We hire students for part-time serving, kitchen help, and social media roles.',
      },
    });
  }

  const studentUser = await prisma.user.upsert({
    where: { email: 'student@demo.com' },
    update: {},
    create: {
      email: 'student@demo.com',
      passwordHash,
      role: UserRole.STUDENT,
      emailVerified: true,
      subscription: { create: { plan: 'FREE' } },
      studentProfile: {
        create: {
          fullName: 'Priya Patel',
          age: 21,
          city: 'Mumbai',
          state: 'Maharashtra',
          bio: 'B.Com student looking for part-time and internship opportunities.',
          education: 'Bachelor of Commerce',
          schoolCollege: 'Mumbai University',
          course: 'B.Com',
          passingYear: 2026,
          skills: ['Customer Service', 'MS Excel', 'Communication', 'Social Media'],
          languages: ['English', 'Hindi', 'Marathi'],
          availability: ['PART_TIME', 'INTERNSHIP', 'WEEKEND'],
          latitude: 19.076,
          longitude: 72.8777,
          experience: [{ title: 'Volunteer', company: 'College Fest', years: 0 }],
        },
      },
    },
    include: { studentProfile: true },
  });

  const employer2 = await prisma.user.create({
    data: {
      email: 'techstart@demo.com',
      passwordHash,
      role: UserRole.EMPLOYER,
      emailVerified: true,
      subscription: { create: { plan: 'FREE', jobPostsRemaining: 2 } },
      employerProfile: {
        create: {
          businessName: 'TechStart Solutions',
          ownerName: 'Amit Kumar',
          category: 'Technology',
          description: 'SMB software company hiring interns and junior developers.',
          city: 'Bangalore',
          state: 'Karnataka',
          latitude: 12.9716,
          longitude: 77.5946,
          isVerified: true,
        },
      },
    },
    include: { employerProfile: true },
  });

  const jobs = await Promise.all([
    prisma.job.create({
      data: {
        employerId: employerUser.employerProfile!.id,
        title: 'Part-Time Cafe Server',
        category: 'Hospitality',
        jobType: JobType.PART_TIME,
        salaryMin: 12000,
        salaryMax: 18000,
        openings: 3,
        requiredSkills: ['Customer Service', 'Communication'],
        educationRequirement: '12th pass or pursuing graduation',
        experienceRequired: 'Fresher welcome',
        freshersOnly: true,
        city: 'Mumbai',
        state: 'Maharashtra',
        latitude: 19.0596,
        longitude: 72.8295,
        workMode: WorkMode.ON_SITE,
        description: 'Looking for friendly part-time servers for evening shifts. Flexible hours for students.',
        isFeatured: true,
      },
    }),
    prisma.job.create({
      data: {
        employerId: employerUser.employerProfile!.id,
        title: 'Social Media Intern',
        category: 'Marketing',
        jobType: JobType.INTERNSHIP,
        salaryMin: 5000,
        salaryMax: 8000,
        openings: 2,
        requiredSkills: ['Social Media', 'Communication', 'Canva'],
        freshersOnly: true,
        city: 'Mumbai',
        workMode: WorkMode.HYBRID,
        description: 'Help manage Instagram and create content for our cafe brand.',
      },
    }),
    prisma.job.create({
      data: {
        employerId: employer2.employerProfile!.id,
        title: 'Frontend Developer Intern',
        category: 'Technology',
        jobType: JobType.INTERNSHIP,
        salaryMin: 10000,
        salaryMax: 15000,
        requiredSkills: ['React', 'JavaScript', 'HTML', 'CSS'],
        educationRequirement: 'Pursuing CS/IT degree',
        city: 'Bangalore',
        latitude: 12.9716,
        longitude: 77.5946,
        workMode: WorkMode.REMOTE,
        description: 'Build UI components for our SaaS product. Mentorship provided.',
        isFeatured: true,
      },
    }),
    prisma.job.create({
      data: {
        employerId: employer2.employerProfile!.id,
        title: 'Data Entry Operator',
        category: 'Administration',
        jobType: JobType.PART_TIME,
        salaryMin: 8000,
        salaryMax: 12000,
        requiredSkills: ['MS Excel', 'Data Entry'],
        freshersOnly: true,
        city: 'Bangalore',
        workMode: WorkMode.ON_SITE,
        description: 'Part-time data entry role, 4 hours daily. Perfect for students.',
      },
    }),
  ]);

  await prisma.application.create({
    data: {
      jobId: jobs[0].id,
      studentId: studentUser.studentProfile!.id,
      status: ApplicationStatus.SHORTLISTED,
      matchScore: 87,
      coverLetter: 'I have customer service experience from college events and am available on weekends.',
    },
  });

  console.log('Seed completed!');
  console.log('Admin: admin@localjob.app / Password123!');
  console.log('Employer: employer@demo.com / Password123!');
  console.log('Student: student@demo.com / Password123!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
