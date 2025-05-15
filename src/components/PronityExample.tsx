'use client';

import { useState, useEffect } from 'react';
import { fetchInterests, Interest, fetchTopicsByInterest, Topic } from '../api/pronityClient';

/**
 * Example component demonstrating Pronity Backend integration
 * Shows a list of interests and their related topics
 */
export default function PronityExample() {
  const [interests, setInterests] = useState<Interest[]>([]);
  const [selectedInterest, setSelectedInterest] = useState<string | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch interests on component mount
  useEffect(() => {
    const loadInterests = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchInterests();
        setInterests(data);
        if (data.length > 0) {
          setSelectedInterest(data[0].id);
        }
      } catch (err) {
        setError('Failed to load interests. Make sure the Pronity backend is running.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadInterests();
  }, []);

  // Fetch topics when selected interest changes
  useEffect(() => {
    if (!selectedInterest) return;

    const loadTopics = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchTopicsByInterest(selectedInterest);
        setTopics(data);
      } catch (err) {
        setError('Failed to load topics');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadTopics();
  }, [selectedInterest]);

  // Handle interest selection change
  const handleInterestChange = (interestId: string) => {
    setSelectedInterest(interestId);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">Pronity Integration Example</h1>
      
      {error && (
        <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">
          {error}
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Interests</h2>
        {loading && interests.length === 0 ? (
          <p>Loading interests...</p>
        ) : interests.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {interests.map((interest) => (
              <button
                key={interest.id}
                onClick={() => handleInterestChange(interest.id)}
                className={`px-4 py-2 rounded-full ${
                  selectedInterest === interest.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
              >
                {interest.name}
              </button>
            ))}
          </div>
        ) : (
          <p>No interests found. Please ensure the Pronity backend is running and has data.</p>
        )}
      </div>

      {selectedInterest && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Topics</h2>
          {loading && topics.length === 0 ? (
            <p>Loading topics...</p>
          ) : topics.length > 0 ? (
            <ul className="space-y-2">
              {topics.map((topic) => (
                <li
                  key={topic.id}
                  className="p-3 bg-gray-50 rounded border border-gray-200"
                >
                  <h3 className="font-medium">{topic.name}</h3>
                  <p className="text-sm text-gray-600">{topic.description}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p>No topics found for this interest.</p>
          )}
        </div>
      )}
    </div>
  );
}
