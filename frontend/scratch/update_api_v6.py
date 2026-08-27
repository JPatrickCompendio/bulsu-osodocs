import os

file_path = r'c:\Users\User\OneDrive\Desktop\OSODOCS\bulsu-osodocs\supabase\functions\api\index.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
in_target_block = False
skip_count = 0

for line in lines:
    if 'async function handleCreateDraftSubmission' in line:
        in_target_block = True
    
    if in_target_block and 'const { data: events } = await supabase' in line and '.eq(\'event_type\', \'submission_window\');' in lines[lines.index(line)+5]:

        target_replacement = """  const { data: events } = await supabase
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

  const windowEvent = events?.find((e) => {
    const semOk = !e.semester_id || !activeSem || e.semester_id === activeSem.id;
    const boundsOk = isWithinBounds(e.start_date, e.end_date);
    return semOk && boundsOk;
  }) || events?.find((e) => isWithinBounds(e.start_date, e.end_date)) || events?.[0];

  if (!windowEvent) {
    return jsonResponse({ action: 'blocked', reason: 'No submission window is currently available.' });
  }
"""
        new_lines.append(target_replacement)
        skip_count = 27 # skip old lines down to if (!isWithinBounds)
        in_target_block = False
        continue

    if skip_count > 0:
        skip_count -= 1
        continue

    new_lines.append(line)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('Successfully updated api/index.ts via update_api_v6.py')
