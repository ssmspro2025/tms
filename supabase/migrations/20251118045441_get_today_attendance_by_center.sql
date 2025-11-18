CREATE OR REPLACE FUNCTION get_today_attendance_by_center(
  center_uuid UUID,
  attendance_date DATE
)
RETURNS TABLE (
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT a.status
  FROM public.attendance a
  JOIN public.students s ON a.student_id = s.id
  WHERE s.center_id = center_uuid
  AND a.date = attendance_date;
END;
$$ LANGUAGE plpgsql;
