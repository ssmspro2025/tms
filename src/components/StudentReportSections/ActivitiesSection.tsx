import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

interface ActivityData {
  id: string;
  activity_name: string;
  activity_type: string;
  activity_date: string;
  involvement_score: number;
  participation_rating: string;
  teacher_notes: string;
}

interface ActivitiesSectionProps {
  studentId: string;
}

const ActivitiesSection: React.FC<ActivitiesSectionProps> = ({ studentId }) => {
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    avgScore: 0,
    excellent: 0,
  });

  useEffect(() => {
    if (studentId) {
      fetchActivitiesData();
    }
  }, [studentId]);

  const fetchActivitiesData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('student_activities')
        .select('id, activities(title, activity_types(name), activity_date), involvement_score, participation_rating, teacher_notes')
        .eq('student_id', studentId)
        .order('activities(activity_date)', { ascending: false });

      if (error) throw error;

      const enriched = data?.map((sa: any) => ({
        id: sa.id,
        activity_name: sa.activities?.title || 'Unknown',
        activity_type: sa.activities?.activity_types?.name || 'Unknown',
        activity_date: sa.activities?.activity_date || 'N/A',
        involvement_score: sa.involvement_score || 0,
        participation_rating: sa.participation_rating || 'N/A',
        teacher_notes: sa.teacher_notes || '',
      })) || [];

      setActivities(enriched);

      if (enriched.length > 0) {
        const avgScore = enriched.reduce((sum: number, a: any) => sum + (a.involvement_score || 0), 0) / enriched.length;
        const excellent = enriched.filter((a: any) => a.participation_rating === 'excellent').length;

        setStats({
          total: enriched.length,
          avgScore: parseFloat(avgScore.toFixed(1)),
          excellent,
        });
      }
    } catch (error) {
      console.error('Error fetching activities data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'excellent':
        return 'bg-green-100 text-green-800';
      case 'good':
        return 'bg-blue-100 text-blue-800';
      case 'fair':
        return 'bg-yellow-100 text-yellow-800';
      case 'needs_improvement':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Preschool Activities & Development
        </CardTitle>
        <CardDescription>Child development through activities</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-gray-600">Activities</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600">Avg Involvement</p>
            <p className="text-2xl font-bold text-blue-600">{stats.avgScore}/5</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600">Excellent Rating</p>
            <p className="text-2xl font-bold text-green-600">{stats.excellent}</p>
          </div>
        </div>

        {/* Activities List */}
        {activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div key={activity.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold">{activity.activity_name}</p>
                    <p className="text-sm text-gray-600">{activity.activity_type} | {activity.activity_date}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getRatingColor(activity.participation_rating)}`}>
                    {activity.participation_rating}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Involvement Score:</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`w-5 h-5 rounded-full ${
                            i <= activity.involvement_score ? 'bg-yellow-400' : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-semibold">{activity.involvement_score}/5</span>
                  </div>
                </div>

                {activity.teacher_notes && (
                  <p className="text-sm text-gray-600 mt-2">Notes: {activity.teacher_notes}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-sm">No activity records found</p>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivitiesSection;
