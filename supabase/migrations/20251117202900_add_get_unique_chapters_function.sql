
CREATE OR REPLACE FUNCTION get_unique_chapters(p_center_id bigint)
RETURNS TABLE(id bigint, subject text, chapter_name text) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (c.subject, c.chapter_name)
    c.id,
    c.subject,
    c.chapter_name
  FROM
    chapters c
  WHERE
    c.center_id = p_center_id
  ORDER BY
    c.subject,
    c.chapter_name,
    c.date_taught DESC;
END;
$$ LANGUAGE plpgsql;
