import type { DiscGolfMetrixRawCourseRecord } from "../../integration/discgolfmetrix";

export const validCourseFixture: DiscGolfMetrixRawCourseRecord = {
  id: "course-101",
  name: "Tiraz Park",
  fullname: "Tiraz Park Championship Layout",
  type: "18-hole",
  countryCode: "RU",
  area: "Moscow",
  ratingValue1: 4.7,
  ratingResult1: 128,
  ratingValue2: 4.5,
  ratingResult2: 56,
  holes: [
    { number: 1, par: 3 },
    { number: 2, par: 4 },
    { number: 3, par: 5 },
  ],
};

export const nestedCourseFixture: DiscGolfMetrixRawCourseRecord = {
  course: {
    id: "course-202",
    name: "Primorsky Park",
    fullname: "Primorsky Park North",
    type: "layout",
    country_code: "RU",
    area: "Saint Petersburg",
    rating_value1: "4.9",
    rating_result1: "90",
    rating_value2: "4.4",
    rating_result2: "25",
    layout: {
      holes: [
        { hole: 1, par: "3" },
        { hole: 2, par: "3" },
        { hole: 3, par: "4" },
      ],
    },
  },
};

export const brokenCourseFixture: DiscGolfMetrixRawCourseRecord = {
  id: "course-bad",
  fullname: "Broken Layout",
  holes: [{ number: 1 }, { number: 2, par: "oops" }],
};
