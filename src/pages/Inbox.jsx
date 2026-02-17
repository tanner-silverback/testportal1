import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Send, Loader2, Plus, Paperclip, X, ChevronLeft, Mail } from 'lucide-react';
import { format } from 'date-fns';

export default function Inbox() {
  const [user, setUser] = useState(null);
  const [selectedThread, setSelectedThread] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [category, setCategory] = useState('Other');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showNewThread, setShowNewThread] = useState(false);

  const queryClient = useQueryClient();

  React.useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const isAdmin = user?.role === 'admin';
  const customerEmail = user?.email;

  // Fetch all messages for the user
  const { data: allMessages = [], isLoading } = useQuery({
    queryKey: ['messages', user?.email, isAdmin],
    queryFn: async () => {
      try {
        const response = await base44.functions.invoke('getMessages', {});
        return response.data?.messages || [];
      } catch (error) {
        console.error('Error fetching messages:', error);
        return [];
      }
    },
    enabled: !!user,
    retry: 1,
    staleTime: 30000
  });

  const threads = React.useMemo(() => {
    if (!allMessages || allMessages.length === 0) return [];
    
    const threadMap = {};
    allMessages.forEach(msg => {
      if (!msg?.thread_id || !msg?.sent_by) return;
      
      if (!threadMap[msg.thread_id]) {
        threadMap[msg.thread_id] = [];
      }
      threadMap[msg.thread_id].push(msg);
    });
    
    Object.keys(threadMap).forEach(threadId => {
      threadMap[threadId].sort((a, b) => {
        const dateA = new Date(a.created_date);
        const dateB = new Date(b.created_date);
        return dateA - dateB;
      });
    });

    return Object.entries(threadMap)
      .map(([threadId, messages]) => ({
        threadId,
        messages,
        subject: messages[0]?.subject || 'No Subject',
        lastMessage: messages[messages.length - 1]
      }))
      .sort((a, b) => {
        const dateA = new Date(a.lastMessage?.created_date || 0);
        const dateB = new Date(b.lastMessage?.created_date || 0);
        return dateB - dateA;
      });
  }, [allMessages]);

  // Handle thread query parameter
  React.useEffect(() => {
    if (threads.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const threadParam = urlParams.get('thread');
      if (threadParam) {
        const thread = threads.find(t => t.threadId === threadParam);
        if (thread) {
          setSelectedThread(thread);
        }
      }
    }
  }, [threads]);

  const sendMessageMutation = useMutation({
    mutationFn: async ({ threadId, subject, messageBody, fileUrls, category, customerEmail, customerName }) => {
      const response = await base44.functions.invoke('sendMessage', {
        threadId: threadId || null,
        subject: subject || 'No Subject',
        messageBody,
        fileUrls: fileUrls || [],
        category: category || 'Other',
        customerEmail: customerEmail || user?.email,
        customerName: customerName || user?.full_name
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      setNewMessage('');
      setNewSubject('');
      setCategory('Other');
      setFiles([]);
      setShowNewThread(false);
    },
    onError: () => {
      alert('Failed to send message. Please try again.');
    }
  });

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    setUploading(true);
    try {
      const fileUrls = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        fileUrls.push(file_url);
      }

      // For replies: always use the customer email from the first message in thread
      // For new messages: use the current user's email
      const threadCustomerEmail = selectedThread?.messages?.[0]?.customer_email;
      const threadCustomerName = selectedThread?.messages?.[0]?.customer_name;

      await sendMessageMutation.mutateAsync({
        threadId: selectedThread?.threadId || null,
        subject: selectedThread ? selectedThread.subject : newSubject || 'No Subject',
        messageBody: newMessage,
        fileUrls,
        category: selectedThread ? selectedThread.messages[0]?.category : category,
        customerEmail: threadCustomerEmail || user.email,
        customerName: threadCustomerName || user.full_name
      });
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const validFiles = selectedFiles.filter(f => f.size <= 10 * 1024 * 1024);
    
    if (validFiles.length !== selectedFiles.length) {
      alert('Some files were too large (max 10MB per file)');
    }
    
    setFiles([...files, ...validFiles]);
  };

  const formatDate = (dateStr) => {
    try {
      return format(new Date(dateStr), 'MMM dd, yyyy h:mm a');
    } catch {
      return dateStr;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }

  // New Thread View
  if (showNewThread) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setShowNewThread(false)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">New Message</h1>
              <p className="text-sm text-slate-500">Start a new conversation</p>
            </div>
          </div>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Subject</label>
                <Input
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Enter subject..."
                />
              </div>

              {!isAdmin && (
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Regarding</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Policy">Policy</SelectItem>
                      <SelectItem value="Claim">Claim</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Message</label>
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  rows={8}
                />
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Attachments</p>
                  {files.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-50 p-2 rounded">
                      <span className="text-sm text-slate-600 truncate">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <input
                  type="file"
                  id="file-upload-new"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('file-upload-new').click()}
                  disabled={uploading || sendMessageMutation.isPending}
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  Attach Files
                </Button>

                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || uploading || sendMessageMutation.isPending}
                  className="flex-1 bg-slate-900 hover:bg-slate-800"
                >
                  {uploading || sendMessageMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Message
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Thread View
  if (selectedThread) {
    const threadMessages = selectedThread.messages;

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedThread(null)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{selectedThread.subject}</h1>
              <p className="text-sm text-slate-500">{threadMessages.length} messages</p>
            </div>
          </div>

          {/* Messages */}
          <div className="space-y-4">
            {threadMessages.map((msg) => (
              <Card key={msg.id} className={`border-0 shadow-sm ${msg.sent_by === 'admin' ? 'bg-blue-50' : 'bg-white'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-slate-900">
                          {msg.sent_by === 'admin' ? 'SilverBack Team' : msg.customer_name}
                        </p>
                        {msg.category && isAdmin && (
                          <Badge variant="outline" className="text-xs">
                            {msg.category}
                          </Badge>
                        )}
                      </div>
                      {isAdmin && msg.customer_email && (
                        <p className="text-xs text-slate-500">{msg.customer_email}</p>
                      )}
                      <p className="text-xs text-slate-500">{formatDate(msg.created_date)}</p>
                    </div>
                    <Badge variant={msg.sent_by === 'admin' ? 'default' : 'secondary'}>
                      {msg.sent_by === 'admin' ? 'Team' : 'You'}
                    </Badge>
                  </div>
                  <p className="text-slate-700 whitespace-pre-wrap">{msg.message_body}</p>
                  
                  {msg.file_urls && msg.file_urls.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <p className="text-xs font-medium text-slate-500 mb-2">Attachments</p>
                      {msg.file_urls.map((url, idx) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline block"
                        >
                          {url.split('/').pop()}
                        </a>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Reply Box */}
          <Card className="border-0 shadow-lg">
            <CardContent className="p-4 space-y-4">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your reply..."
                rows={4}
              />

              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-50 p-2 rounded">
                      <span className="text-sm text-slate-600 truncate">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <input
                  type="file"
                  id="file-upload"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('file-upload').click()}
                  disabled={uploading || sendMessageMutation.isPending}
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  Attach
                </Button>

                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || uploading || sendMessageMutation.isPending}
                  className="flex-1 bg-slate-900 hover:bg-slate-800"
                >
                  {uploading || sendMessageMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Reply
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Thread List View
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 rounded-lg">
              <MessageCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
              <p className="text-sm text-slate-500">View and send messages</p>
            </div>
          </div>
          <Button onClick={() => setShowNewThread(true)} className="bg-slate-900 hover:bg-slate-800">
            <Plus className="h-4 w-4 mr-2" />
            New Message
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
          </div>
        ) : threads.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <Mail className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 mb-4">No messages yet</p>
              <Button onClick={() => setShowNewThread(true)} variant="outline">
                Start a conversation
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {threads.map((thread) => (
              <Card
                key={thread.threadId}
                className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedThread(thread)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900">{thread.subject}</h3>
                        {thread.messages[0]?.category && isAdmin && (
                          <Badge variant="outline" className="text-xs">
                            {thread.messages[0].category}
                          </Badge>
                        )}
                      </div>
                      {isAdmin && thread.messages[0]?.customer_name && (
                        <p className="text-xs text-slate-600 mb-1">
                          From: {thread.messages[0].customer_name} ({thread.messages[0].customer_email})
                        </p>
                      )}
                      <p className="text-sm text-slate-600 line-clamp-2">{thread.lastMessage.message_body}</p>
                      <p className="text-xs text-slate-500 mt-2">
                        Last message: {formatDate(thread.lastMessage.created_date)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-slate-600">
                      {thread.messages.length}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}