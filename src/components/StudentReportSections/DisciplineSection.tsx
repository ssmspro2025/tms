import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface DisciplineIssueData {
  id: string;
  category_name: string;
  issue_date: string;
  description: string;
  severity: string;
  resolved: boolean;
  action_type: string;
}

interface DisciplineSectionProps {
  studentId: string;
}

const DisciplineSection: React.FC<DisciplineSectionProps> = ({ studentId }) => {
  const [issues, setIssues] = useState<DisciplineIssueData[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    resolved: 0,
    pending: 0,
  });

  useEffect(() => {
    if (studentId) {
      fetchDisciplineData();
    }
  }, [studentId]);

  const fetchDisciplineData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('discipline_issues')
        .select('id, discipline_categories(name), issue_date, description, severity, resolved, discipline_actions(action_type)')
        .eq('student_id', studentId)
        .order('issue_date', { ascending: false });

      if (error) throw error;

      const enriched = data?.map((issue: any) => ({
        id: issue.id,
        category_name: issue.discipline_categories?.name || 'Unknown',
        issue_date: issue.issue_date,
        description: issue.description,
        severity: issue.severity,
        resolved: issue.resolved,
        action_type: issue.discipline_actions?.[0]?.action_type || 'Not specified',
      })) || [];

      setIssues(enriched);

      setStats({
        total: enriched.length,
        resolved: enriched.filter((i: any) => i.resolved).length,
        pending: enriched.filter((i: any) => !i.resolved).length,
      });
    } catch (error) {
      console.error('Error fetching discipline data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Discipline & Conduct Record
        </CardTitle>
        <CardDescription>Issues and corrective actions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Total Issues</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600">Resolved</p>
            <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <p className="text-sm text-gray-600">Pending</p>
            <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
          </div>
        </div>

        {/* Issues List */}
        {issues.length > 0 ? (
          <div className="space-y-3">
            {issues.map((issue) => (
              <div key={issue.id} className={`border rounded-lg p-4 ${getSeverityColor(issue.severity)}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold">{issue.category_name}</p>
                    <p className="text-sm mt-1">{issue.description}</p>
                    <p className="text-sm mt-2">Date: {issue.issue_date} | Action: {issue.action_type}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-4 ${
                      issue.resolved ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                    }`}
                  >
                    {issue.resolved ? '✓ Resolved' : 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-sm">No discipline issues recorded</p>
        )}
      </CardContent>
    </Card>
  );
};

export default DisciplineSection;
