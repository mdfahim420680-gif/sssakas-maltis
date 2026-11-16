import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Bell, Heart, LifeBuoy, MapPin, Package, Plus, Trash2, User } from 'lucide-react';
import { AppDispatch, RootState } from '../store';
import { fetchCurrentUser, setUnreadNotifications } from '../store/authSlice';
import { pushToast } from '../store/uiSlice';
import { apiRequest, formatBDT } from '../lib/api';
import { BANGLADESH_DIVISIONS } from '../../shared/bangladeshGeo';
import { ProductCard } from '../components/ui/ProductCard';

export function AccountPage({ defaultTab = 'profile' }: { defaultTab?: string }) {
  const { user } = useSelector((s: RootState) => s.auth);
  const dispatch = useDispatch<AppDispatch>();
  const [tab, setTab] = useState(defaultTab);
  const [orders, setOrders] = useState<any[]>([]);
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');

  // New Address state
  const [addrLabel, setAddrLabel] = useState('Home');
  const [addrDivision, setAddrDivision] = useState('Dhaka');
  const [addrDistrict, setAddrDistrict] = useState('Dhaka');
  const [addrUpazila, setAddrUpazila] = useState('Dhanmondi');
  const [addrUnion, setAddrUnion] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrPostal, setAddrPostal] = useState('1209');

  // Support ticket state
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('order');
  const [ticketMessage, setTicketMessage] = useState('');

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setPhone(user.phone || '');
    apiRequest('/api/orders').then((r) => setOrders(r.orders || [])).catch(() => {});
    apiRequest('/api/auth/wishlist').then((r) => setWishlist(r.items || [])).catch(() => {});
    apiRequest('/api/auth/notifications').then((r) => setNotifications(r.notifications || [])).catch(() => {});
    apiRequest('/api/auth/support').then((r) => setTickets(r.tickets || [])).catch(() => {});
  }, [user]);

  const divObj = BANGLADESH_DIVISIONS.find((d) => d.name === addrDivision) || BANGLADESH_DIVISIONS[0];
  const distObj = divObj.districts.find((d) => d.name === addrDistrict) || divObj.districts[0];

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, phone }),
      });
      await dispatch(fetchCurrentUser());
      dispatch(pushToast({ type: 'success', title: 'Profile Updated' }));
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Update Failed', message: err.message }));
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/auth/addresses', {
        method: 'POST',
        body: JSON.stringify({
          label: addrLabel,
          fullName: name || user?.name,
          phone: phone || user?.phone || '01711223344',
          division: addrDivision,
          district: addrDistrict,
          upazila: addrUpazila,
          unionOrArea: addrUnion,
          streetAddress: addrStreet,
          postalCode: addrPostal,
          isDefault: true,
        }),
      });
      await dispatch(fetchCurrentUser());
      setAddrUnion('');
      setAddrStreet('');
      dispatch(pushToast({ type: 'success', title: 'Address Saved' }));
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Invalid Address', message: err.message }));
    }
  };

  const handleDeleteAddress = async (id: string) => {
    await apiRequest(`/api/auth/addresses/${id}`, { method: 'DELETE' });
    await dispatch(fetchCurrentUser());
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/auth/support', {
        method: 'POST',
        body: JSON.stringify({
          subject: ticketSubject,
          category: ticketCategory,
          message: ticketMessage,
        }),
      });
      setTicketSubject('');
      setTicketMessage('');
      const r = await apiRequest('/api/auth/support');
      setTickets(r.tickets || []);
      dispatch(pushToast({ type: 'success', title: 'Support Ticket Opened' }));
    } catch (err: any) {
      dispatch(pushToast({ type: 'error', title: 'Ticket Error', message: err.message }));
    }
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-3 space-y-1">
          {[
            { id: 'profile', label: 'My Profile & Addresses', icon: User },
            { id: 'orders', label: `My Orders (${orders.length})`, icon: Package },
            { id: 'wishlist', label: `Wishlist (${wishlist.length})`, icon: Heart },
            { id: 'notifications', label: `Notifications (${notifications.length})`, icon: Bell },
            { id: 'support', label: `Support Tickets (${tickets.length})`, icon: LifeBuoy },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                tab === item.id ? 'bg-[#0D63F3] text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </aside>

        <div className="lg:col-span-9 space-y-5">
          {tab === 'profile' && (
            <>
              <form onSubmit={handleProfileSave} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                <h1 className="text-lg font-bold text-slate-900">Account Profile</h1>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number</label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                </div>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-[#0D63F3] text-white text-xs font-bold">
                  Save Profile
                </button>
              </form>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#0D63F3]" /> Saved Bangladesh Addresses
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(user?.addresses || []).map((a: any) => (
                    <div key={a._id} className="p-3.5 rounded-xl border border-slate-200 text-xs flex justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-900">
                          {a.label} {a.isDefault && <span className="text-[#0D63F3]">(Default)</span>}
                        </p>
                        <p className="text-slate-600 mt-0.5">{a.streetAddress}, {a.unionOrArea}</p>
                        <p className="text-slate-500">{a.upazila}, {a.district}, {a.division} - {a.postalCode}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAddress(a._id)}
                        aria-label="Delete address"
                        className="p-1 text-slate-400 hover:text-red-600 self-start"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddAddress} className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    placeholder="Label (Home / Office)"
                    value={addrLabel}
                    onChange={(e) => setAddrLabel(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-slate-300 text-xs"
                  />
                  <select
                    value={addrDivision}
                    onChange={(e) => {
                      setAddrDivision(e.target.value);
                      const d = BANGLADESH_DIVISIONS.find((x) => x.name === e.target.value);
                      if (d) {
                        setAddrDistrict(d.districts[0].name);
                        setAddrUpazila(d.districts[0].upazilas[0].name);
                      }
                    }}
                    className="h-9 px-3 rounded-lg border border-slate-300 text-xs bg-white"
                  >
                    {BANGLADESH_DIVISIONS.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
                  </select>
                  <select
                    value={addrDistrict}
                    onChange={(e) => {
                      setAddrDistrict(e.target.value);
                      const dist = divObj.districts.find((x) => x.name === e.target.value);
                      if (dist) setAddrUpazila(dist.upazilas[0].name);
                    }}
                    className="h-9 px-3 rounded-lg border border-slate-300 text-xs bg-white"
                  >
                    {divObj.districts.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
                  </select>
                  <select
                    value={addrUpazila}
                    onChange={(e) => setAddrUpazila(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-slate-300 text-xs bg-white"
                  >
                    {distObj.upazilas.map((u) => <option key={u.name} value={u.name}>{u.name}</option>)}
                  </select>
                  <input
                    required
                    placeholder="Area / Ward"
                    value={addrUnion}
                    onChange={(e) => setAddrUnion(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-slate-300 text-xs"
                  />
                  <input
                    required
                    maxLength={4}
                    placeholder="Postal Code (e.g. 1209)"
                    value={addrPostal}
                    onChange={(e) => setAddrPostal(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-slate-300 text-xs"
                  />
                  <input
                    required
                    placeholder="Street / House / Flat address"
                    value={addrStreet}
                    onChange={(e) => setAddrStreet(e.target.value)}
                    className="sm:col-span-2 h-9 px-3 rounded-lg border border-slate-300 text-xs"
                  />
                  <button
                    type="submit"
                    className="h-9 px-4 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Address
                  </button>
                </form>
              </div>
            </>
          )}

          {tab === 'orders' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h1 className="text-lg font-bold text-slate-900">My Orders</h1>
              {orders.length === 0 ? (
                <p className="text-xs text-slate-500">You have not placed any orders yet.</p>
              ) : (
                <div className="space-y-3">
                  {orders.map((ord) => (
                    <Link
                      key={ord._id}
                      to={`/orders/${ord._id}`}
                      className="block p-4 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-sm font-extrabold text-slate-900 font-mono-num">
                            {ord.orderNumber}
                          </span>
                          <span className="ml-2 text-xs text-slate-500">
                            {new Date(ord.createdAt).toLocaleDateString()} · {ord.subOrders?.length || 0} seller package(s)
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs uppercase font-semibold text-slate-600">
                            {ord.paymentMethod} ({ord.paymentStatus})
                          </span>
                          <span className="text-sm font-extrabold text-[#0D63F3] tabular-nums">
                            {formatBDT(ord.grandTotal)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'wishlist' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h1 className="text-lg font-bold text-slate-900">My Wishlist</h1>
              {wishlist.length === 0 ? (
                <p className="text-xs text-slate-500">No saved products in your wishlist.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {wishlist.map((p) => (
                    <ProductCard key={p._id} product={p} />
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'notifications' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-bold text-slate-900">Notifications</h1>
                <button
                  type="button"
                  onClick={() =>
                    apiRequest('/api/auth/notifications/read-all', { method: 'PATCH' }).then(() => {
                      setNotifications((n) => n.map((x) => ({ ...x, read: true })));
                      dispatch(setUnreadNotifications(0));
                    })
                  }
                  className="text-xs font-bold text-[#0D63F3] hover:underline"
                >
                  Mark all read
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-500">No notifications yet.</p>
                ) : (
                  notifications.map((n) => (
                    <div key={n._id} className={`py-3 ${n.read ? 'opacity-75' : ''}`}>
                      <p className="text-xs font-bold text-slate-900">{n.title}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'support' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
              <h1 className="text-lg font-bold text-slate-900">Support Tickets</h1>
              <form onSubmit={handleCreateTicket} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    required
                    placeholder="Subject"
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs"
                  />
                  <select
                    value={ticketCategory}
                    onChange={(e) => setTicketCategory(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs"
                  >
                    <option value="order">Order Issue</option>
                    <option value="payment">Payment / Refund</option>
                    <option value="return">Return Dispute</option>
                    <option value="general">General Inquiry</option>
                  </select>
                </div>
                <textarea
                  required
                  minLength={10}
                  rows={2}
                  placeholder="Describe your issue..."
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  className="w-full p-3 rounded-lg border border-slate-300 bg-white text-xs"
                />
                <button type="submit" className="px-4 py-2 rounded-lg bg-[#0D63F3] text-white text-xs font-bold">
                  Open Support Ticket
                </button>
              </form>

              <div className="space-y-3">
                {tickets.map((t) => (
                  <div key={t._id} className="p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        {t.ticketNumber} — {t.subject}
                      </span>
                      <span className="uppercase font-bold text-[#0D63F3]">{t.status.replace(/_/g, ' ')}</span>
                    </div>
                    {t.messages?.map((m: any, idx: number) => (
                      <p key={idx} className="text-slate-600">
                        <strong>{m.senderName}:</strong> {m.body}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
