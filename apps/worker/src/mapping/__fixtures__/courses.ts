import type { DiscGolfMetrixRawCourseRecord } from "../../integration/discgolfmetrix";

export const validCourseFixture: DiscGolfMetrixRawCourseRecord = {
  course: {
    ID: "course-101",
    Name: "Tiraz Park",
    Fullname: "Tiraz Park Championship Layout",
    Type: "2",
    CountryCode: "RU",
    Area: "Moscow",
    RatingValue1: "845.92",
    RatingResult1: "56.41",
    RatingValue2: "1000",
    RatingResult2: "43.57",
  },
  baskets: [
    { Number: "1", Par: "3" },
    { Number: "2", Par: "4" },
    { Number: "3", Par: "5" },
  ],
};

export const nestedCourseFixture: DiscGolfMetrixRawCourseRecord = {
  course: {
    ID: "course-202",
    Name: "Primorsky Park",
    Fullname: "Primorsky Park North",
    Type: "layout",
    CountryCode: "RU",
    Area: "Saint Petersburg",
    RatingValue1: "4.9",
    RatingResult1: "90",
    RatingValue2: "4.4",
    RatingResult2: "25",
    layout: {
      holes: [
        { hole: 1, Par: "3" },
        { hole: 2, Par: "3" },
        { hole: 3, Par: "4" },
      ],
    },
  },
};

export const brokenCourseFixture: DiscGolfMetrixRawCourseRecord = {
  course: {
    ID: "course-bad",
    Fullname: "Broken Layout",
  },
  baskets: [{ Number: "1" }, { Number: "2", Par: "oops" }],
};
