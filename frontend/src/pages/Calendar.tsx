import React, { useState, useEffect } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Clock, MapPin, Users, Video, Calendar as CalendarIcon, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { API_URL } from '../config';

interface CalendarEvent {
  id: number;
  title: string;
  type: 'meeting' | 'call' | 'deadline' | 'presentation' | 'submission' | 'review';
  date: string;
  start?: string;
  end?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  attendees?: string[];
  participants?: string[];
  pitchId?: number;
  pitchTitle?: string;
  description?: string;
  isVirtual?: boolean;
  meetingLink?: string;
  color?: string;
  reminder?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [loading, setLoading] = useState(true);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedDateEvents, setSelectedDateEvents] = useState<CalendarEvent[]>([]);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [newEvent, setNewEvent] = useState({
    title: '',
    type: 'meeting',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    duration: '60',
    location: '',
    attendees: '',
    description: '',
    color: '#8b5cf6',
    reminder: '15'
  });

  useEffect(() => {
    fetchEvents();
  }, [currentDate, view]);

  const fetchEvents = async () => {
    try {
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString();

      const response = await fetch(
        `${API_URL}/api/creator/calendar/events?start=${startDate}&end=${endDate}`,
        {
          credentials: 'include'
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        
        // Handle the response structure - it's wrapped in data property
        const eventsArray = data.data?.events || data.events || [];

        // Map events preserving all fields; normalize date from multiple possible sources
        const formattedEvents: CalendarEvent[] = eventsArray
          .filter((e: any) => e != null)
          .map((e: any) => {
            const dateStr = e.date || (e.start_date ? new Date(e.start_date).toISOString().split('T')[0] : null)
              || (e.start_time ? new Date(e.start_time).toISOString().split('T')[0] : null)
              || (e.start ? new Date(e.start).toISOString().split('T')[0] : null);
            return {
              id: e.id,
              title: e.title,
              type: e.type || 'meeting',
              date: dateStr,
              start: e.start || e.start_time || e.start_date || undefined,
              end: e.end || e.end_time || e.end_date || undefined,
              description: e.description || undefined,
              color: e.color || '#8b5cf6',
              location: e.location || undefined,
              attendees: e.attendees || undefined,
            } as CalendarEvent;
          })
          .filter((e: CalendarEvent) => e.date != null);

        setEvents(formattedEvents);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validate required fields
      if (!newEvent.title.trim()) {
        toast.error('Please enter a title for the event');
        return;
      }
      
      if (!newEvent.date || !newEvent.time) {
        toast.error('Please select both date and time for the event');
        return;
      }
      
      // Log the values for debugging
      console.info('Creating event:', {
        date: newEvent.date,
        time: newEvent.time,
        title: newEvent.title
      });
      
      // Ensure time has seconds if missing (some browsers don't include seconds)
      const timeWithSeconds = newEvent.time.includes(':') && newEvent.time.split(':').length === 2 
        ? `${newEvent.time}:00` 
        : newEvent.time;
      
      // Combine date and time with proper validation
      const dateTimeString = `${newEvent.date}T${timeWithSeconds}`;
      
      const eventDateTime = new Date(dateTimeString);
      
      // Check if the date is valid
      if (isNaN(eventDateTime.getTime())) {
        console.error('Invalid date/time:', {
          dateTimeString,
          date: newEvent.date,
          time: newEvent.time,
          parsedDate: eventDateTime
        });
        toast.error('Invalid date or time format. Please check your input.');
        return;
      }
      
      // Parse duration with validation
      const durationMinutes = parseInt(newEvent.duration) || 60; // Default to 60 minutes if invalid
      
      const eventData = {
        title: newEvent.title,
        type: newEvent.type,
        start: eventDateTime.toISOString(),
        end: new Date(eventDateTime.getTime() + durationMinutes * 60000).toISOString(),
        location: newEvent.location,
        attendees: newEvent.attendees.split(',').map(email => email.trim()).filter(Boolean),
        description: newEvent.description,
        color: newEvent.color,
        reminder: newEvent.reminder
      };
      
    const response = await fetch(`${API_URL}/api/calendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData),
      credentials: 'include' // Send cookies for Better Auth session
    });
      
      if (response.ok) {
        const result = await response.json();
        
        // Add the new event to the local state if it exists
        if (result.event) {
          setEvents([...events, result.event]);
        }
        
        // Reset form and close modal
        setNewEvent({
          title: '',
          type: 'meeting',
          date: new Date().toISOString().split('T')[0],
          time: '09:00',
          duration: '60',
          location: '',
          attendees: '',
          description: '',
          color: '#8b5cf6',
          reminder: '15'
        });
        setShowEventModal(false);
        
        // Show success notification
        toast.success('Event created successfully!');
        
        // Refresh events to ensure consistency
        fetchEvents();
      } else {
        throw new Error('Failed to create event');
      }
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Failed to create event. Please try again.');
    }
  };

  const handleDayClick = (date: Date) => {
    // Set the selected date
    setSelectedDate(date);
    
    // Get events for this date
    const dayEvents = getEventsForDate(date);
    
    // Format the date for the input field (YYYY-MM-DD)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;
    
    // Update the new event form with the selected date
    setNewEvent(prev => ({
      ...prev,
      date: formattedDate
    }));
    
    // If there are events, show the view modal, otherwise show create modal
    if (dayEvents.length > 0) {
      setSelectedDateEvents(dayEvents);
      setShowViewModal(true);
    } else {
      setShowEventModal(true);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    for (let i = 0; i < 42; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push(day);
    }
    
    return days;
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      if (!event || !event.date) return false;
      const eventDate = new Date(event.date);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'meeting':
        return 'bg-blue-500';
      case 'call':
        return 'bg-green-500';
      case 'deadline':
        return 'bg-red-500';
      case 'presentation':
        return 'bg-purple-500';
      case 'submission':
        return 'bg-indigo-500';
      case 'review':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'meeting':
        return <Users className="w-3 h-3" />;
      case 'call':
        return <Video className="w-3 h-3" />;
      case 'deadline':
        return <Clock className="w-3 h-3" />;
      case 'presentation':
        return <CalendarIcon className="w-3 h-3" />;
      case 'submission':
        return <ArrowLeft className="w-3 h-3" />;
      case 'review':
        return <Clock className="w-3 h-3" />;
      default:
        return <CalendarIcon className="w-3 h-3" />;
    }
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow-sm">
          {/* Calendar Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-2 text-gray-500 hover:text-gray-700 transition rounded-lg hover:bg-gray-100"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-semibold text-gray-900">
                {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                {events.length > 0 && (
                  <span className="ml-2 text-sm text-purple-600">
                    ({events.length} events)
                  </span>
                )}
              </h2>

              <button
                onClick={() => navigateMonth('next')}
                className="p-2 text-gray-500 hover:text-gray-700 transition rounded-lg hover:bg-gray-100"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                {(['month', 'week', 'day'] as const).map((viewType) => (
                  <button
                    key={viewType}
                    onClick={() => setView(viewType)}
                    className={`px-3 py-1 text-sm rounded-md transition capitalize ${
                      view === viewType
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {viewType}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition"
              >
                Today
              </button>

              <button
                onClick={() => setShowEventModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                <Plus className="w-4 h-4" />
                New Event
              </button>
            </div>
          </div>

          {view === 'month' && (
            <div className="p-6">
              {/* Days Header */}
              <div className="grid grid-cols-7 gap-px mb-2">
                {DAYS.map((day) => (
                  <div key={day} className="py-2 text-center text-sm font-medium text-gray-500">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
                {getDaysInMonth(currentDate).map((date, index) => {
                  const dayEvents = getEventsForDate(date);
                  const isCurrentMonthDay = isCurrentMonth(date);
                  const isTodayDate = isToday(date);
                  const isSelectedDate = selectedDate && 
                    date.getDate() === selectedDate.getDate() && 
                    date.getMonth() === selectedDate.getMonth() && 
                    date.getFullYear() === selectedDate.getFullYear();
                  
                  return (
                    <div
                      key={index}
                      onClick={() => handleDayClick(date)}
                      onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                        if (dayEvents.length > 0) {
                          setHoveredDate(date);
                          const rect = e.currentTarget.getBoundingClientRect();
                          setMousePosition({
                            x: rect.left + rect.width / 2,
                            y: rect.top
                          });
                        }
                      }}
                      onMouseLeave={() => setHoveredDate(null)}
                      className={`bg-white p-2 min-h-[120px] cursor-pointer hover:bg-gray-50 transition relative ${
                        !isCurrentMonthDay ? 'text-gray-400' : ''
                      } ${isSelectedDate ? 'ring-2 ring-purple-500 bg-purple-50' : ''}`}
                    >
                      <div className={`text-sm font-medium mb-1 ${
                        isTodayDate 
                          ? 'bg-purple-600 text-white w-6 h-6 rounded-full flex items-center justify-center' 
                          : ''
                      }`}>
                        {date.getDate()}
                      </div>
                      
                      {/* Event indicators */}
                      <div className="space-y-0.5 mt-1">
                        {dayEvents.slice(0, 3).map((event, idx) => (
                          <div
                            key={idx}
                            className="text-xs px-1.5 py-0.5 rounded truncate text-white leading-tight"
                            style={{ backgroundColor: event.color || '#8b5cf6' }}
                            title={event.title}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-xs text-gray-500 pl-1">+{dayEvents.length - 3} more</span>
                        )}
                      </div>
                      
                      {/* Show event count badge */}
                      {dayEvents.length > 0 && (
                        <div className="absolute top-1 right-1 bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {dayEvents.length}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === 'week' && (() => {
            const weekStart = new Date(currentDate);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            const weekDays = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(weekStart);
              d.setDate(d.getDate() + i);
              return d;
            });
            return (
              <div className="p-4">
                <div className="grid grid-cols-7 gap-2">
                  {weekDays.map((day) => {
                    const dayStr = day.toISOString().split('T')[0];
                    const dayEvents = events.filter(e => e.date?.startsWith(dayStr));
                    const isToday = dayStr === new Date().toISOString().split('T')[0];
                    return (
                      <div key={dayStr} className={`border rounded-lg p-3 min-h-[200px] ${isToday ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200'}`}>
                        <div className={`text-sm font-medium mb-2 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                          {day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                        {dayEvents.length === 0 ? (
                          <p className="text-xs text-gray-400">No events</p>
                        ) : (
                          <div className="space-y-1">
                            {dayEvents.map(ev => (
                              <div key={ev.id} className="text-xs bg-purple-100 text-purple-700 rounded px-2 py-1 truncate">
                                {ev.start && <span className="font-medium">{ev.start} </span>}
                                {ev.title}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {view === 'day' && (() => {
            const dayStr = (selectedDate || currentDate).toISOString().split('T')[0];
            const dayEvents = events.filter(e => e.date?.startsWith(dayStr));
            const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7 AM to 8 PM
            return (
              <div className="p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {(selectedDate || currentDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </h3>
                <div className="space-y-0">
                  {hours.map(hour => {
                    const hourStr = `${hour.toString().padStart(2, '0')}:`;
                    const hourEvents = dayEvents.filter(e => e.start?.startsWith(hourStr));
                    return (
                      <div key={hour} className="flex border-t border-gray-100 min-h-[48px]">
                        <div className="w-16 text-xs text-gray-500 py-2 pr-2 text-right shrink-0">
                          {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
                        </div>
                        <div className="flex-1 py-1 pl-2">
                          {hourEvents.map(ev => (
                            <div key={ev.id} className="text-sm bg-purple-100 text-purple-800 rounded px-2 py-1 mb-1">
                              <span className="font-medium">{ev.title}</span>
                              {ev.location && <span className="text-purple-600 ml-2 text-xs">{ev.location}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {dayEvents.length === 0 && (
                  <div className="text-center text-gray-500 py-8">No events scheduled for this day</div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Today's Events Sidebar */}
        <div className="mt-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {selectedDate 
                ? `Events for ${selectedDate.toLocaleDateString()}`
                : 'Today\'s Events'
              }
            </h3>
            
            {(() => {
              const displayDate = selectedDate || new Date();
              const dayEvents = getEventsForDate(displayDate);
              
              return dayEvents.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No events scheduled</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {dayEvents.map((event) => (
                    <div key={event.id} className="border rounded-lg p-4 hover:shadow-md transition">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded text-white ${getEventTypeColor(event.type)}`}>
                            {getEventTypeIcon(event.type)}
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{event.title}</h4>
                            <p className="text-sm text-gray-500">
                              {formatTime(event.startTime || '')} - {formatTime(event.endTime || '')}
                            </p>
                          </div>
                        </div>
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded capitalize">
                          {event.type}
                        </span>
                      </div>
                      
                      {event.pitchTitle && (
                        <p className="text-sm text-purple-600 mb-2">Re: {event.pitchTitle}</p>
                      )}
                      
                      {event.description && (
                        <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        {event.isVirtual ? (
                          <div className="flex items-center gap-1">
                            <Video className="w-4 h-4" />
                            <span>Virtual Meeting</span>
                          </div>
                        ) : event.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>{event.location}</span>
                          </div>
                        )}
                        
                        {((event.participants?.length || 0) > 0 || (event.attendees?.length || 0) > 0) && (
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>{(event.participants?.length || event.attendees?.length || 0)} participants</span>
                          </div>
                        )}
                      </div>
                      
                      {event.meetingLink && (
                        <div className="mt-3">
                          <a
                            href={event.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm"
                          >
                            <Video className="w-4 h-4" />
                            Join Meeting
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Event Hover Tooltip */}
      {hoveredDate && (() => {
        const hoveredEvents = getEventsForDate(hoveredDate);
        if (hoveredEvents.length === 0) return null;
        
        return (
          <div 
            className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-80 pointer-events-none"
            style={{
              left: `${mousePosition.x}px`,
              top: `${mousePosition.y - 10}px`,
              transform: 'translate(-50%, -100%)'
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">
                {hoveredDate.toLocaleDateString('en-US', { 
                  weekday: 'long',
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h3>
              <span className="text-sm text-purple-600 font-medium">
                {hoveredEvents.length} event{hoveredEvents.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {hoveredEvents.map((event) => (
                <div key={event.id} className="border-l-4 pl-3 py-2" style={{ borderColor: event.color || '#8b5cf6' }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{event.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          {getEventTypeIcon(event.type)}
                        </span>
                        <span className="text-xs text-gray-500 capitalize">
                          {event.type}
                        </span>
                        {event.start && (
                          <span className="text-xs text-gray-500">
                            {new Date(event.start).toLocaleTimeString('en-US', { 
                              hour: 'numeric', 
                              minute: '2-digit',
                              hour12: true 
                            })}
                          </span>
                        )}
                      </div>
                      {event.location && (
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {event.location}
                        </p>
                      )}
                      {event.description && (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 text-center">
                Click to view details
              </p>
            </div>
          </div>
        );
      })()}

      {/* View Events Modal */}
      {showViewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Events for {selectedDate?.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedDateEvents.length} event{selectedDateEvents.length !== 1 ? 's' : ''} scheduled
                </p>
              </div>
              <button
                onClick={() => setShowViewModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Events List */}
            <div className="space-y-4 mb-6">
              {selectedDateEvents.map((event) => (
                <div 
                  key={event.id} 
                  className="border rounded-lg p-4 hover:shadow-md transition"
                  style={{ borderLeftWidth: '4px', borderLeftColor: event.color || '#8b5cf6' }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 text-lg">{event.title}</h4>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          {getEventTypeIcon(event.type)}
                          <span className="capitalize">{event.type}</span>
                        </div>
                        {event.start && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>
                              {new Date(event.start).toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit',
                                hour12: true 
                              })}
                              {event.end && ` - ${new Date(event.end).toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit',
                                hour12: true 
                              })}`}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {event.location && (
                        <div className="flex items-center gap-2 mt-3 text-sm text-gray-600">
                          <MapPin className="w-4 h-4" />
                          <span>{event.location}</span>
                        </div>
                      )}
                      
                      {(event.attendees?.length || 0) > 0 && (
                        <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                          <Users className="w-4 h-4" />
                          <span>
                            {event.attendees?.length} attendee{event.attendees?.length !== 1 ? 's' : ''}
                            {event.attendees && event.attendees.length <= 3 && ': ' + event.attendees.join(', ')}
                          </span>
                        </div>
                      )}
                      
                      {event.description && (
                        <p className="mt-3 text-sm text-gray-700 bg-gray-50 p-3 rounded">
                          {event.description}
                        </p>
                      )}
                    </div>
                    
                    <div className="ml-4">
                      <div className={`px-3 py-1 rounded-full text-xs text-white ${getEventTypeColor(event.type)}`}>
                        {event.type}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add New Event Button */}
            <div className="border-t pt-4">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setShowEventModal(true);
                }}
                className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add New Event for This Day
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Create New Event</h3>
                {selectedDate && (
                  <p className="text-sm text-gray-500 mt-1">
                    For {selectedDate.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowEventModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-6">
              {/* Event Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  required
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Pitch Review Meeting"
                />
              </div>

              {/* Event Type */}
              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                  Event Type *
                </label>
                <select
                  id="type"
                  name="type"
                  required
                  value={newEvent.type}
                  onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="meeting">Meeting</option>
                  <option value="call">Call</option>
                  <option value="deadline">Deadline</option>
                  <option value="presentation">Presentation</option>
                  <option value="review">Review</option>
                  <option value="submission">Submission</option>
                </select>
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    id="date"
                    name="date"
                    required
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">
                    Time *
                  </label>
                  <input
                    type="time"
                    id="time"
                    name="time"
                    required
                    value={newEvent.time}
                    onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Duration */}
              <div>
                <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
                  Duration
                </label>
                <select
                  id="duration"
                  name="duration"
                  value={newEvent.duration}
                  onChange={(e) => setNewEvent({ ...newEvent, duration: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                  <option value="180">3 hours</option>
                  <option value="all-day">All day</option>
                </select>
              </div>

              {/* Location/Link */}
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                  Location / Meeting Link
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={newEvent.location}
                    onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                    className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., Conference Room A or https://zoom.us/..."
                  />
                  <MapPin className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Attendees */}
              <div>
                <label htmlFor="attendees" className="block text-sm font-medium text-gray-700 mb-1">
                  Attendees
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="attendees"
                    name="attendees"
                    value={newEvent.attendees}
                    onChange={(e) => setNewEvent({ ...newEvent, attendees: e.target.value })}
                    className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter email addresses separated by commas"
                  />
                  <Users className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Add event details, agenda, or notes..."
                />
              </div>

              {/* Color Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event Color
                </label>
                <div className="flex gap-2">
                  {['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewEvent({ ...newEvent, color })}
                      className={`w-8 h-8 rounded-full border-2 ${
                        newEvent.color === color ? 'border-gray-900' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Reminder */}
              <div>
                <label htmlFor="reminder" className="block text-sm font-medium text-gray-700 mb-1">
                  Reminder
                </label>
                <select
                  id="reminder"
                  name="reminder"
                  value={newEvent.reminder}
                  onChange={(e) => setNewEvent({ ...newEvent, reminder: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="none">No reminder</option>
                  <option value="5">5 minutes before</option>
                  <option value="15">15 minutes before</option>
                  <option value="30">30 minutes before</option>
                  <option value="60">1 hour before</option>
                  <option value="1440">1 day before</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
                >
                  <CalendarIcon className="w-4 h-4" />
                  Create Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}