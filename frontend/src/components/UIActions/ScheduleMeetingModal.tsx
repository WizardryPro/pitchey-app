import React, { useState } from 'react';
import { X, Calendar, Video, Phone, MapPin } from 'lucide-react';
import { useScheduleMeeting } from '../../hooks/useUIActions';

interface ScheduleMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientId: string;
  recipientName: string;
  meetingType?: 'pitch' | 'investment' | 'production' | 'demo';
  defaultSubject?: string;
}

export function ScheduleMeetingModal({
  isOpen,
  onClose,
  recipientId,
  recipientName,
  meetingType = 'pitch',
  defaultSubject = ''
}: ScheduleMeetingModalProps) {
  const { scheduleMeeting, loading } = useScheduleMeeting();
  const [formData, setFormData] = useState({
    subject: defaultSubject || `Meeting with ${recipientName}`,
    date: '',
    time: '',
    duration: '60',
    method: 'video',
    message: '',
    alternativeTimes: ['', '', '']
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const proposedTimes = [
      formData.date && formData.time ? `${formData.date}T${formData.time}` : '',
      ...formData.alternativeTimes.filter(Boolean)
    ].filter(Boolean);

    const result = await scheduleMeeting(
      recipientId,
      formData.subject,
      meetingType,
      {
        proposedTimes,
        message: formData.message
      }
    );

    if (result.success) {
      onClose();
    }
  };

  const updateAlternativeTime = (index: number, value: string) => {
    const newTimes = [...formData.alternativeTimes];
    newTimes[index] = value;
    setFormData({ ...formData, alternativeTimes: newTimes });
  };

  const meetingMethods = [
    { value: 'video', label: 'Video Call', icon: Video },
    { value: 'phone', label: 'Phone Call', icon: Phone },
    { value: 'in-person', label: 'In Person', icon: MapPin },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Schedule Meeting with {recipientName}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meeting Subject
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Primary Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preferred Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preferred Time
              </label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Alternative Times */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Alternative Times (optional)
            </label>
            <div className="space-y-2">
              {formData.alternativeTimes.map((time, index) => (
                <input
                  key={index}
                  type="datetime-local"
                  value={time}
                  onChange={(e) => updateAlternativeTime(index, e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`Alternative ${index + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (minutes)
            </label>
            <select
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
              <option value="120">2 hours</option>
            </select>
          </div>

          {/* Meeting Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meeting Method
            </label>
            <div className="grid grid-cols-3 gap-3">
              {meetingMethods.map((method) => {
                const Icon = method.icon;
                return (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, method: method.value })}
                    className={`p-3 rounded-md border-2 flex flex-col items-center gap-1 transition ${
                      formData.method === method.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm">{method.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message (optional)
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add any additional notes or agenda items..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Scheduling...
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4" />
                  Schedule Meeting
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}