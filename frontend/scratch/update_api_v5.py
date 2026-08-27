import os

file_path = r'c:\Users\User\OneDrive\Desktop\OSODOCS\bulsu-osodocs\supabase\functions\api\index.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Update submission window check in handleCreateDraftSubmission
old_check = """  const { data: events } = await supabase
    .from('academic_calendar_events')
    .select('*')
    .eq('school_year_id', activeSy.id)
    .eq('semester_id', activeSem.id)
    .eq('document_type_id', documentTypeId)
    .eq('event_type', 'submission_window');

  const windowEvent = events?.[0];
  if (!windowEvent) {
    return jsonResponse({ action: 'blocked', reason: 'No submission window is currently available.' });
  }

  const currentDate = new Date();
  const start = windowEvent.start_date ? new Date(windowEvent.start_date) : null;
  const end = windowEvent.end_date ? new Date(windowEvent.end_date) : null;
  let isWithinBounds = true;
  if (start && end) isWithinBounds = currentDate >= start && currentDate <= end;
  else if (start) isWithinBounds = currentDate >= start;
  else if (end) isWithinBounds = currentDate <= end;

  if (!isWithinBounds) {
    return jsonResponse({ action: 'blocked', reason: 'Submission window is closed for the selected dates.' });
  }"""

new_check = """  const { data: events } = await supabase
    .from('academic_calendar_events')
    .select('*')
    .eq('school_year_id', activeSy.id)
    .eq('document_type_id', documentTypeId)
    .eq('event_type', 'submission_window');

  const currentDate = new Date();
  const isWithinBounds = (start_date: string | null, end_date: string | null) => {
    if (!start_date && !end_date) return true;
    const start = start_date ? new Date(start_date) : null;
    const end = end_date ? new Date(end_date) : null;
    if (start && end) return currentDate >= start && currentDate <= end;
    if (start) return currentDate >= start;
    if (end) return currentDate <= end;
    return false;
  };

  const validWindow = events?.find((e) => {
    const semMatches = !e.semester_id || e.semester_id === activeSem.id;
    const boundsOk = isWithinBounds(e.start_date, e.end_date);
    return semMatches && boundsOk;
  });

  if (!validWindow) {
    return jsonResponse({ action: 'blocked', reason: 'No submission window is currently available for this document type.' });
  }"""

if old_check in content:
    content = content.replace(old_check, new_check)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated api/index.ts via update_api_v5.py!')
