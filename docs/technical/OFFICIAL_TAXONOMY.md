# Official LPU Events Category & Subcategory Taxonomy

This document is the **single source of truth** for all primary categories and subcategories across the entire LPU Events platform (database seed, SuperAdmin Taxonomy Manager, and Student Web Portal).

---

## 1. Summary of Primary Categories

| # | Category Name | Key Slug | Database UUID | Icon Concept |
|---|---------------|----------|---------------|--------------|
| 1 | **Academics** | `academics` | `c4444444-4444-4444-4444-444444444444` | GraduationCap |
| 2 | **Cultural** | `cultural` | `c2222222-2222-2222-2222-222222222222` | Sparkles / Music |
| 3 | **Innovation** | `innovation` | `c1111111-1111-1111-1111-111111111111` | Lightbulb / Rocket |
| 4 | **Entrepreneurship** | `entrepreneurship` | `c4000000-0000-0000-0000-000000000001` | Briefcase / TrendingUp |
| 5 | **Schools** | `schools` | `c5000000-0000-0000-0000-000000000001` | BookOpen / Building |
| 6 | **Community Services** | `community-services` | `c6000000-0000-0000-0000-000000000001` | Heart / Users |
| 7 | **Day Celebrations** | `day-celebrations` | `c7000000-0000-0000-0000-000000000001` | CalendarDays / Flag |
| 8 | **Co-Curricular** | `co-curricular` | `c3333333-3333-3333-3333-333333333333` | Trophy / Award |
| 9 | **Student Clubs & Org** | `student-clubs` | `c9000000-0000-0000-0000-000000000001` | Users / Sparkle |
| 10 | **NCC** | `ncc` | `ca000000-0000-0000-0000-000000000001` | Shield / Target |
| 11 | **NSS** | `nss` | `cb000000-0000-0000-0000-000000000001` | HandHeart / Globe |
| 12 | **Fashion** | `fashion` | `cc000000-0000-0000-0000-000000000001` | Shirt / Sparkles |
| 13 | **Others** | `others` | `cd000000-0000-0000-0000-000000000001` | MoreHorizontal / Layers |

---

## 2. Complete Category & Subcategory Breakdown

### 1. Academics
- **Seminar**
- **Guest Lecture**
- **Workshop**
- **Internship**
- **Capstone**
- **Others**

### 2. Cultural
- **Music**
- **Dance**
- **Theatre**
- **Social Media**
- **Others**

### 3. Innovation
- **Hackathon**
- **Technical Events**
- **Project Expo**
- **Workshop**
- **Seminar**
- **Others**

### 4. Entrepreneurship
- **B-Plan Competition**
- **Pitch Fest**
- **Conclave**
- **Bootcamp**
- **Panel Discussion**
- **Expo**
- **Seminar**
- **Others**

### 5. Schools (Organized by Departmental Groups)

#### A. Engineering & Technology
1. School of AI and Emerging Technologies
2. School of Bio Engineering and Biosciences
3. School of Chemical Engineering and Physical Sciences
4. School of Computer Applications
5. School of Computer Science and Engineering
6. School of Computing and Artificial Intelligence
7. School of Electronics and Electrical Engineering
8. School of Mechanical Engineering

#### B. Arts, Design & Architecture
1. Lovely School of Architecture and Design
2. School of Design (Fashion Design & Technology)
3. School of Design (Interior & Product Design)
4. School of Design (Multimedia)
5. School of Liberal and Creative Arts (Films, Theatre and Music)
6. School of Liberal and Creative Arts (Fine Arts)
7. School of Liberal and Creative Arts (Journalism and Mass Communication)
8. School of Liberal and Creative Arts (Social Sciences and Languages)

#### C. Business, Law & Management
1. Mittal School of Business
2. School of Agriculture
3. School of Hotel Management and Tourism
4. School of Law

#### D. Health, Education & Professional
1. School of Allied Medical Sciences
2. School of Education
3. School of Education (Physical Education)
4. School of Pharmaceutical Sciences
5. School of Polytechnic

### 6. Community Services
- **Donation Drives**
- **Environment**
- **Healthcare**
- **Others**

### 7. Day Celebrations
- **National Days**
- **Cultural Days**
- **Fest Days**
- **Awareness Days**
- **Others**

### 8. Co-Curricular
- **Skill Development**
- **Certifications**
- **Training Programs**
- **Competitions**
- **Others**

### 9. Student Clubs & Org
- **Technical Clubs**
- **Cultural Clubs**
- **Startup Clubs**
- **Literary Clubs**
- **Others**

### 10. NCC
- **Camps**
- **Training**
- **Parades**
- **Others**

### 11. NSS
- **Social Work**
- **Campaigns**
- **Awareness Drives**
- **Others**

### 12. Fashion
- **Shows**
- **Exhibitions**
- **Others**

### 13. Others
- **Miscellaneous Events**

---

## 3. Implementation Guidelines
1. **Never hardcode arbitrary category names** outside this specification.
2. In the student website, subcategories must be hidden when viewing "ALL" and appear **only** when a specific category is active.
3. If "Schools" is selected, the subcategories can be organized by the 4 major departmental groups for instant navigation.
4. Database migrations (`20260814000015_official_platform_taxonomy.sql`) and seeds (`seed.sql`) match these exact keys and UUIDs.
