import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import '../../proctor.css';

export default function ActivityFeed({ events = [] }) {

  const getEmoji = (type) => {
    if (!type) return '📋';
    if (type.includes('kick')) return '🚫';
    if (type.includes('violation') || type.includes('warning')) return '⚠️';
    if (type.includes('submit')) return '📤';
    if (type.includes('start')) return '🟢';
    if (type.includes('network')) return '📡';
    return '📋';
  };

  return (
    <div className="live-events-panel" style={{ height: 300 }}>
      {events.length === 0 ? (
        <div style={{ margin: 'auto', color: '#64748B' }}>Waiting for activity events...</div>
      ) : (
        events.map((evt) => (
          <div className="event-log-item" key={evt.id}>
            <span style={{ marginRight: 8 }}>{getEmoji(evt.activity_type)}</span>
            <span className="event-time">[{new Date(evt.created_at).toLocaleTimeString()}]</span>{' '}
            <span style={{ color: '#F8FAFC' }}>
              {evt.message}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
