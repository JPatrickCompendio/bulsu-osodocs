import re
import sys

def resolve():
    with open('supabase/functions/api/index.ts', 'r', encoding='utf-8') as f:
        content = f.read()

    # Block 1: logsQuery in org-president
    # (Checking if it exists in this file)

    # Block 2: submissionSelect
    content = re.sub(
        r'<<<<<<< HEAD\n\s*\'id, status, created_at, school_year_id, documentType:document_type_id\(name\), submission_versions!submission_versions_submission_id_fkey\(version_number, activity_proposal_details\(activity_title, target_venue, person_in_charge, contact_number\)\)\';\n=======\n\s*\'id, status, created_at, school_year_id, semester_id, documentType:document_type_id\(name\), submission_versions!submission_id\(version_number, activity_proposal_details\(activity_title\)\)\';\n>>>>>>> origin/main',
        r"'id, status, created_at, school_year_id, semester_id, documentType:document_type_id(name), submission_versions!submission_versions_submission_id_fkey(version_number, activity_proposal_details(activity_title, target_venue, person_in_charge, contact_number))';",
        content,
        flags=re.MULTILINE
    )

    # Block 3: logsQuery admin
    content = re.sub(
        r'<<<<<<< HEAD\n\s*\.select\(\'\*, submissions\(tracking_number,\s*status, school_year_id, documentType:document_type_id\(name\), submission_versions!submission_versions_submission_id_fkey\(version_number, activity_proposal_details\(activity_title\)\)\)\'\)\n=======\n\s*\.select\(\'\*, submissions\(tracking_number, status, school_year_id, semester_id, documentType:document_type_id\(name\), submission_versions!submission_id\(version_number, activity_proposal_details\(activity_title\)\)\)\'\)\n>>>>>>> origin/main',
        r".select('*, submissions(tracking_number, status, school_year_id, semester_id, documentType:document_type_id(name), submission_versions!submission_versions_submission_id_fkey(version_number, activity_proposal_details(activity_title)))')",
        content,
        flags=re.MULTILINE
    )

    # Block 4: currentSySubmissions filter
    content = re.sub(
        r'<<<<<<< HEAD\n\s*const currentSySubmissions = activeSy\n\s*\? submissions\.filter\(\(s\) => !s\.school_year_id \|\| s\.school_year_id === activeSy\.id\)\n=======\n\s*let currentSySubmissions = activeSy\n\s*\? submissions\.filter\(\(s\) => s\.school_year_id === activeSy\.id\)\n>>>>>>> origin/main',
        r"  let currentSySubmissions = activeSy\n    ? submissions.filter((s) => !s.school_year_id || s.school_year_id === activeSy.id)",
        content,
        flags=re.MULTILINE
    )

    # Are there any other conflicts? Let's check logsQuery in org-president again just in case
    content = re.sub(
        r'<<<<<<< HEAD\n\s*let logsQuery = supabase\n\s*\.from\(\'submission_logs\'\)\n\s*\.select\(\'\*, submissions\(tracking_number, school_year_id, documentType:document_type_id\(name\), submission_versions!submission_versions_submission_id_fkey\(version_number, activity_proposal_details\(activity_title\)\)\)\'\)\n\s*\.eq\(\'user_id\', id\)\n\s*\.order\(\'created_at\', \{ ascending: false \}\)\n\s*\.limit\(25\);\n\n\s*const \{ data: logs \} = await logsQuery;\n\s*activityHistory = \(logs \|\| \[\]\)\n\s*\.filter\(\(log\) => \{\n\s*const sub = log\.submissions as Record<string, unknown> \| null;\n\s*return !activeSy \|\| !sub\?\.school_year_id \|\| sub\.school_year_id === activeSy\.id;\n\s*\}\)\n\s*\.map\(\(log\) => \{\n\s*const sub = log\.submissions as Record<string, unknown> \| null;\n\s*let docTitle = null;\n\s*if \(sub\) \{\n\s*const versions = sub\.submission_versions as Array<Record<string, unknown>> \| undefined;\n\s*if \(versions && versions\.length > 0\) \{\n\s*const latest = versions\.reduce\(\n\s*\(max, v\) => \(\(v\.version_number as number\) > \(max\.version_number as number\) \? v : max\),\n\s*versions\[0\],\n\s*\);\n\s*const details = Array\.isArray\(latest\.activity_proposal_details\)\n\s*\? latest\.activity_proposal_details\[0\]\n\s*: latest\.activity_proposal_details;\n\s*if \(details && \(details as Record<string, unknown>\)\.activity_title\) \{\n\s*docTitle = \(details as Record<string, unknown>\)\.activity_title as string;\n\s*\}\n\s*\}\n\s*if \(!docTitle\) \{\n\s*docTitle = \(sub\.documentType as Record<string, unknown>\)\?\.name as string \|\| null;\n\s*\}\n\s*\}\n\s*return \{\n\s*\.\.\.log,\n\s*docTitle,\n\s*trackingNumber: sub\?\.tracking_number \|\| null,\n\s*\};\n=======\n\s*let logsQuery = supabase\n\s*\.from\(\'submission_logs\'\)\n\s*\.select\(\'\*, submissions\(tracking_number, school_year_id, semester_id\)\'\)\n\s*\.eq\(\'user_id\', id\)\n\s*\.order\(\'created_at\', \{ ascending: false \}\)\n\s*\.limit\(20\);\n\n\s*const \{ data: logs \} = await logsQuery;\n\s*activityHistory = \(logs \|\| \[\]\)\.filter\(\(log\) => \{\n\s*const sub = log\.submissions as Record<string, unknown> \| null;\n\s*if \(activeSy && sub\?\.school_year_id && sub\.school_year_id !== activeSy\.id\) return false;\n\s*if \(semesterId && semesterId !== \'all\' && sub\?\.semester_id && sub\.semester_id !== semesterId\) return false;\n\s*return true;\n>>>>>>> origin/main',
        r"""    let logsQuery = supabase
      .from('submission_logs')
      .select('*, submissions(tracking_number, school_year_id, semester_id, documentType:document_type_id(name), submission_versions!submission_versions_submission_id_fkey(version_number, activity_proposal_details(activity_title)))')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(25);

    const { data: logs } = await logsQuery;
    activityHistory = (logs || [])
      .filter((log) => {
        const sub = log.submissions as Record<string, unknown> | null;
        if (activeSy && sub?.school_year_id && sub.school_year_id !== activeSy.id) return false;
        if (semesterId && semesterId !== 'all' && sub?.semester_id && sub.semester_id !== semesterId) return false;
        return true;
      })
      .map((log) => {
        const sub = log.submissions as Record<string, unknown> | null;
        let docTitle = null;
        if (sub) {
          const versions = sub.submission_versions as Array<Record<string, unknown>> | undefined;
          if (versions && versions.length > 0) {
            const latest = versions.reduce(
              (max, v) => ((v.version_number as number) > (max.version_number as number) ? v : max),
              versions[0],
            );
            const details = Array.isArray(latest.activity_proposal_details)
              ? latest.activity_proposal_details[0]
              : latest.activity_proposal_details;
            if (details && (details as Record<string, unknown>).activity_title) {
              docTitle = (details as Record<string, unknown>).activity_title as string;
            }
          }
          if (!docTitle) {
            docTitle = (sub.documentType as Record<string, unknown>)?.name as string || null;
          }
        }
        return {
          ...log,
          docTitle,
          trackingNumber: sub?.tracking_number || null,
        };
""",
        content,
        flags=re.MULTILINE
    )

    with open('supabase/functions/api/index.ts', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    resolve()
