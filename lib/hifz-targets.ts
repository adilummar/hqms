export function getDefaultMonthlyTarget(yearOfStudy?: string | null) {
  const normalized = yearOfStudy?.toLowerCase().trim();

  if (normalized === "3rd" || normalized === "3" || normalized === "third") {
    return 2.5;
  }

  if (normalized === "2nd" || normalized === "2" || normalized === "second") {
    return 2;
  }

  return 1;
}

export function currentTargetPeriod(date = new Date()) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}
