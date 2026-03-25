export interface Course {
  courseId: string;
  name: string;
  fullname: string | null;
  type: string | null;
  countryCode: string | null;
  area: string | null;
  ratingValue1: number | null;
  ratingResult1: number | null;
  ratingValue2: number | null;
  ratingResult2: number | null;
  coursePar: number;
  basketsCount: number | null;
}

export interface CourseDbRecord {
  course_id: string;
  name: string;
  fullname: string | null;
  type: string | null;
  country_code: string | null;
  area: string | null;
  rating_value1: number | null;
  rating_result1: number | null;
  rating_value2: number | null;
  rating_result2: number | null;
  course_par: number;
  baskets_count: number | null;
}

export function toCourseDbRecord(course: Course): CourseDbRecord {
  return {
    course_id: course.courseId,
    name: course.name,
    fullname: course.fullname,
    type: course.type,
    country_code: course.countryCode,
    area: course.area,
    rating_value1: course.ratingValue1,
    rating_result1: course.ratingResult1,
    rating_value2: course.ratingValue2,
    rating_result2: course.ratingResult2,
    course_par: course.coursePar,
    baskets_count: course.basketsCount,
  };
}
