import { useState, useRef, useEffect } from "react";
import axios from "axios";

import {
  Bot,
  Send,
  User,
  Package,
  ShieldCheck,
  Sparkles,
  Plus,
  MessageSquare,
  Settings,
  ChevronDown,
  CheckCircle2,
  Database,
  BookOpen,
  Loader2,
  Headphones,
  Zap,
  Search,
  ArrowUpRight,
  Clock3,
  Truck,
  XCircle,
  RefreshCw,
  Server,
  Cpu,
  FileText,
  ArrowLeft,
  UserCircle,
  LogOut,
  CircleHelp
} from "lucide-react";

import "./App.css";

const API_URL = "http://127.0.0.1:8000";

// ==================================================
// REDIS SESSION ID
// ==================================================

const getSessionId = () => {
  let sessionId = localStorage.getItem(
    "resolveai_session_id"
  );

  if (!sessionId) {
    sessionId = "session-" + crypto.randomUUID();

    localStorage.setItem(
      "resolveai_session_id",
      sessionId
    );
  }

  return sessionId;
};

function App() {
  // ==================================================
  // STATE
  // ==================================================

  const [activePage, setActivePage] =
    useState("assistant");

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text:
        "Hi! I'm ResolveAI, your AI support assistant. I can help you track orders, understand company policies, and resolve common support questions."
    }
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] =
    useState(false);

  const [orderSearch, setOrderSearch] =
    useState("");

  const [selectedOrder, setSelectedOrder] =
    useState(null);

  const [escalations, setEscalations] =
    useState([]);

  const [escalationsLoading, setEscalationsLoading] =
    useState(false);

  const [profileOpen, setProfileOpen] =
    useState(false);

  const [notificationsEnabled, setNotificationsEnabled] =
    useState(true);

  const [autoRefresh, setAutoRefresh] =
    useState(false);

  const [escalating, setEscalating] =
    useState(false);

  const [sessionId] = useState(getSessionId);

  const chatRef = useRef(null);

  // ==================================================
  // AUTO SCROLL
  // ==================================================

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop =
        chatRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // ==================================================
  // LOAD ORDERS
  // ==================================================

  const loadOrders = async () => {
    setOrdersLoading(true);

    try {
      const orderIds = [
        "ORD1001",
        "ORD1002",
        "ORD1003",
        "ORD1004"
      ];

      const results = await Promise.all(
        orderIds.map((id) =>
          axios.get(`${API_URL}/orders/${id}`)
        )
      );

      const loadedOrders = results
        .map((result) => result.data.order)
        .filter(Boolean);

      setOrders(loadedOrders);
    } catch (error) {
      console.error(
        "Could not load orders:",
        error
      );
    } finally {
      setOrdersLoading(false);
    }
  };

  // ==================================================
  // LOAD ESCALATIONS
  // ==================================================

  const loadEscalations = async () => {
    setEscalationsLoading(true);

    try {
      const response = await axios.get(
        `${API_URL}/escalations`
      );

      setEscalations(
        response.data.escalations || []
      );
    } catch (error) {
      console.error(
        "Failed to load escalations:",
        error
      );
    } finally {
      setEscalationsLoading(false);
    }
  };

  // ==================================================
  // LOAD DATA WHEN PAGE CHANGES
  // ==================================================

  useEffect(() => {
    if (activePage === "orders") {
      loadOrders();
    }

    if (activePage === "support") {
      loadEscalations();
    }
  }, [activePage]);

  // ==================================================
  // AUTO REFRESH ORDERS
  // ==================================================

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const interval = setInterval(() => {
      loadOrders();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // ==================================================
  // SEND MESSAGE
  // ==================================================

  const sendMessage = async (
    customMessage = null
  ) => {
    const userMessage =
      customMessage !== null
        ? customMessage.trim()
        : input.trim();

    if (!userMessage || loading) {
      return;
    }

    setActivePage("assistant");

    setMessages((previous) => [
      ...previous,
      {
        role: "user",
        text: userMessage
      }
    ]);

    setInput("");
    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/chat`,
        {
          message: userMessage,
          session_id: sessionId
        }
      );

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text: response.data.response,
          toolUsed: response.data.tool_used,
          ragUsed: response.data.rag_used
        }
      ]);
    } catch (error) {
      console.error(
        "Chat error:",
        error
      );

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text:
            "I'm having trouble connecting to the support service right now. Please try again in a moment."
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ==================================================
  // ENTER KEY
  // ==================================================

  const handleKeyDown = (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendMessage();
    }
  };

  // ==================================================
  // NEW CONVERSATION
  // ==================================================

  const newConversation = () => {
    setMessages([
      {
        role: "assistant",
        text:
          "Hi! I'm ResolveAI, your AI support assistant. How can I help you today?"
      }
    ]);

    setInput("");
    setSelectedOrder(null);
    setActivePage("assistant");
  };

  // ==================================================
  // ORDERS
  // ==================================================

  const openOrder = (order) => {
    setSelectedOrder(order);
  };

  const closeOrder = () => {
    setSelectedOrder(null);
  };

  const askAIAboutOrder = (order) => {
    const message =
      `Where is my order ${order.order_id}?`;

    setSelectedOrder(null);
    sendMessage(message);
  };

  // ==================================================
  // ESCALATE TO HUMAN
  // ==================================================

  const escalateToHuman = async () => {
    if (escalating) {
      return;
    }

    const lastUserMessage = [...messages]
      .reverse()
      .find(
        (message) =>
          message.role === "user"
      );

    if (!lastUserMessage) {
      return;
    }

    setEscalating(true);

    try {
      const response = await axios.post(
        `${API_URL}/escalate`,
        {
          session_id: sessionId,
          customer_message:
            lastUserMessage.text,
          reason:
            "Customer requested human support"
        }
      );

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text:
            `Your conversation has been escalated to a human support representative. ` +
            `Your escalation ID is #${response.data.escalation_id}. ` +
            `A support representative can review your request from here.`
        }
      ]);

      // Refresh Support Queue data
      loadEscalations();
    } catch (error) {
      console.error(
        "Escalation error:",
        error
      );

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text:
            "I couldn't create the human support request right now. Please try again in a moment."
        }
      ]);
    } finally {
      setEscalating(false);
    }
  };

  // ==================================================
  // STATUS ICON
  // ==================================================

  const getStatusIcon = (status) => {
    if (status === "Shipped") {
      return <Truck size={15} />;
    }

    if (status === "Processing") {
      return <Clock3 size={15} />;
    }

    if (status === "Delivered") {
      return <CheckCircle2 size={15} />;
    }

    if (status === "Cancelled") {
      return <XCircle size={15} />;
    }

    return <Package size={15} />;
  };

  // ==================================================
  // FILTER ORDERS
  // ==================================================

  const filteredOrders = orders.filter(
    (order) => {
      const search =
        orderSearch.toLowerCase();

      return (
        order.order_id
          .toLowerCase()
          .includes(search) ||
        order.customer_name
          .toLowerCase()
          .includes(search) ||
        order.item
          .toLowerCase()
          .includes(search)
      );
    }
  );

  // ==================================================
  // NAVIGATION
  // ==================================================

  const navigate = (page) => {
    setActivePage(page);
    setSelectedOrder(null);
    setProfileOpen(false);
  };

  // ==================================================
  // SIDEBAR
  // ==================================================

  const renderSidebar = () => (
    <aside className="sidebar">
      <div className="sidebar-top">

        <div className="brand">
          <div className="brand-logo">
            <Sparkles size={19} />
          </div>

          <div>
            <div className="brand-name">
              ResolveAI
            </div>

            <div className="brand-subtitle">
              Support Intelligence
            </div>
          </div>
        </div>

        <button
          className="new-chat"
          onClick={newConversation}
        >
          <Plus size={17} />

          <span>
            New conversation
          </span>

          <span className="shortcut">
            ⌘ N
          </span>
        </button>

        <div className="sidebar-label">
          WORKSPACE
        </div>

        <button
          className={`nav-item ${
            activePage === "assistant"
              ? "active"
              : ""
          }`}
          onClick={() =>
            navigate("assistant")
          }
        >
          <MessageSquare size={17} />

          <span>
            Support assistant
          </span>
        </button>

        <button
          className={`nav-item ${
            activePage === "orders"
              ? "active"
              : ""
          }`}
          onClick={() =>
            navigate("orders")
          }
        >
          <Package size={17} />

          <span>
            Orders
          </span>

          <span className="nav-arrow">
            <ArrowUpRight size={13} />
          </span>
        </button>

        <button
          className={`nav-item ${
            activePage === "support"
              ? "active"
              : ""
          }`}
          onClick={() =>
            navigate("support")
          }
        >
          <Headphones size={17} />

          <span>
            Support Queue
          </span>

          {escalations.length > 0 && (
            <span className="nav-count">
              {escalations.length}
            </span>
          )}
        </button>

        <button
          className={`nav-item ${
            activePage === "knowledge"
              ? "active"
              : ""
          }`}
          onClick={() =>
            navigate("knowledge")
          }
        >
          <BookOpen size={17} />

          <span>
            Knowledge base
          </span>

          <span className="nav-arrow">
            <ArrowUpRight size={13} />
          </span>
        </button>

        <div className="sidebar-label capabilities-label">
          CAPABILITIES
        </div>

        <div className="capability">
          <div className="capability-icon">
            <Zap size={14} />
          </div>

          <div>
            <strong>
              AI-powered answers
            </strong>

            <span>
              Contextual responses
            </span>
          </div>
        </div>

        <div className="capability">
          <div className="capability-icon">
            <Database size={14} />
          </div>

          <div>
            <strong>
              Live order data
            </strong>

            <span>
              Connected to MySQL
            </span>
          </div>
        </div>

        <div className="capability">
          <div className="capability-icon">
            <ShieldCheck size={14} />
          </div>

          <div>
            <strong>
              Grounded responses
            </strong>

            <span>
              Policy-aware assistance
            </span>
          </div>
        </div>

      </div>

      <div className="sidebar-bottom">

        <div className="system-status">
          <div className="status-indicator">
            <span></span>
          </div>

          <div className="status-text">
            <strong>
              All systems operational
            </strong>

            <span>
              ResolveAI services online
            </span>
          </div>
        </div>

        <button
          className={`settings-button ${
            activePage === "settings"
              ? "settings-active"
              : ""
          }`}
          onClick={() =>
            navigate("settings")
          }
        >
          <Settings size={16} />

          <span>
            Settings
          </span>
        </button>

      </div>
    </aside>
  );

  // ==================================================
  // HEADER
  // ==================================================

  const renderHeader = () => {
    let title = "Customer Support";
    let subtitle = "AI support workspace";
    let icon = <Headphones size={18} />;

    if (activePage === "orders") {
      title = "Orders";
      subtitle = "Live customer order data";
      icon = <Package size={18} />;
    }

    if (activePage === "support") {
      title = "Support Queue";
      subtitle = "Human support escalations";
      icon = <Headphones size={18} />;
    }

    if (activePage === "knowledge") {
      title = "Knowledge Base";
      subtitle =
        "Grounding sources for ResolveAI";
      icon = <BookOpen size={18} />;
    }

    if (activePage === "settings") {
      title = "Settings";
      subtitle =
        "ResolveAI configuration";
      icon = <Settings size={18} />;
    }

    return (
      <header className="header">

        <div className="header-left">

          <div className="header-icon">
            {icon}
          </div>

          <div>
            <div className="header-title">
              {title}
            </div>

            <div className="header-subtitle">
              {subtitle}
            </div>
          </div>

        </div>

        <div className="header-right">

          <div className="agent-status">
            <span className="online-dot"></span>
            AI Agent Online
          </div>

          <div className="profile-wrapper">

            <button
              className="agent-profile"
              onClick={() =>
                setProfileOpen(
                  !profileOpen
                )
              }
            >
              <div className="profile-avatar">
                R
              </div>

              <ChevronDown size={14} />
            </button>

            {profileOpen && (
              <div className="profile-menu">

                <div className="profile-menu-header">

                  <div className="profile-menu-avatar">
                    R
                  </div>

                  <div>
                    <strong>
                      ResolveAI Admin
                    </strong>

                    <span>
                      Administrator
                    </span>
                  </div>

                </div>

                <div className="profile-menu-divider"></div>

                <button
                  onClick={() =>
                    navigate("settings")
                  }
                >
                  <UserCircle size={16} />
                  Profile & settings
                </button>

                <button
                  onClick={() =>
                    navigate("knowledge")
                  }
                >
                  <BookOpen size={16} />
                  Knowledge base
                </button>

                <button
                  onClick={() =>
                    navigate("support")
                  }
                >
                  <Headphones size={16} />
                  Support queue
                </button>

                <div className="profile-menu-divider"></div>

                <button
                  onClick={() =>
                    setProfileOpen(false)
                  }
                >
                  <LogOut size={16} />
                  Close menu
                </button>

              </div>
            )}

          </div>

        </div>
      </header>
    );
  };

  // ==================================================
  // ASSISTANT
  // ==================================================

  const renderAssistant = () => (
    <div
      className="chat-area"
      ref={chatRef}
    >
      <div className="conversation">

        {messages.length === 1 && (
          <div className="welcome">

            <div className="welcome-icon">
              <Sparkles size={25} />
            </div>

            <h1>
              How can I help you today?
            </h1>

            <p>
              Ask about an order, company policy,
              shipping, refunds, or payments.
            </p>

            <div className="quick-actions">

              <button
                onClick={() =>
                  sendMessage(
                    "Where is my order ORD1001?"
                  )
                }
              >
                <Package size={16} />
                Track an order
              </button>

              <button
                onClick={() =>
                  sendMessage(
                    "What is your refund policy?"
                  )
                }
              >
                <ShieldCheck size={16} />
                Refund policy
              </button>

              <button
                onClick={() =>
                  sendMessage(
                    "How long does standard shipping take?"
                  )
                }
              >
                <Zap size={16} />
                Shipping times
              </button>

            </div>
          </div>
        )}

        {messages.map(
          (message, index) => (
            <div
              key={index}
              className={`message-row ${message.role}`}
            >

              <div className="message-avatar">
                {message.role === "assistant" ? (
                  <Bot size={17} />
                ) : (
                  <User size={17} />
                )}
              </div>

              <div className="message-wrapper">

                <div className="message-header">

                  <span className="message-author">
                    {message.role === "assistant"
                      ? "ResolveAI"
                      : "You"}
                  </span>

                  {message.role ===
                    "assistant" && (
                    <span className="ai-badge">
                      AI AGENT
                    </span>
                  )}

                </div>

                <div className="message-bubble">
                  {message.text}
                </div>

                {message.role ===
                  "assistant" &&
                  (
                    message.toolUsed ||
                    message.ragUsed
                  ) && (

                  <div className="source-row">

                    {message.toolUsed && (
                      <div className="source-pill">
                        <Database size={12} />
                        <span>
                          Order data
                        </span>
                        <CheckCircle2 size={12} />
                      </div>
                    )}

                    {message.ragUsed && (
                      <div className="source-pill">
                        <BookOpen size={12} />
                        <span>
                          Knowledge base
                        </span>
                        <CheckCircle2 size={12} />
                      </div>
                    )}

                  </div>
                )}

              </div>
            </div>
          )
        )}

        {messages.some(
          (message) =>
            message.role === "user"
        ) &&
          !loading && (
            <div className="escalation-area">

              <button
                className="escalation-button"
                onClick={
                  escalateToHuman
                }
                disabled={escalating}
              >
                {escalating ? (
                  <Loader2
                    size={16}
                    className="spinner"
                  />
                ) : (
                  <Headphones size={16} />
                )}

                {escalating
                  ? "Escalating..."
                  : "Escalate to Human"}
              </button>

              <span>
                Need additional help? A human
                support representative can review
                this conversation.
              </span>

            </div>
          )}

        {loading && (
          <div className="message-row assistant">

            <div className="message-avatar">
              <Bot size={17} />
            </div>

            <div className="message-wrapper">

              <div className="message-header">
                <span className="message-author">
                  ResolveAI
                </span>

                <span className="ai-badge">
                  AI AGENT
                </span>
              </div>

              <div className="typing-bubble">
                <Loader2
                  size={16}
                  className="spinner"
                />

                <span>
                  Thinking...
                </span>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );

  // ==================================================
  // ORDER DETAIL
  // ==================================================

  const renderOrderDetail = () => {
    if (!selectedOrder) {
      return null;
    }

    const order = selectedOrder;

    return (
      <div className="page-container">

        <button
          className="back-button"
          onClick={closeOrder}
        >
          <ArrowLeft size={16} />
          Back to orders
        </button>

        <div className="order-detail-header">

          <div>
            <div className="detail-kicker">
              ORDER DETAILS
            </div>

            <h1>
              {order.order_id}
            </h1>

            <p>
              Complete information for this
              customer order.
            </p>
          </div>

          <span
            className={`status-badge ${
              order.status.toLowerCase()
            }`}
          >
            {getStatusIcon(order.status)}
            {order.status}
          </span>

        </div>

        <div className="order-detail-grid">

          <div className="detail-card">
            <div className="detail-card-title">
              <UserCircle size={18} />
              Customer
            </div>

            <strong>
              {order.customer_name}
            </strong>

            <span>
              Customer account
            </span>
          </div>

          <div className="detail-card">
            <div className="detail-card-title">
              <Package size={18} />
              Product
            </div>

            <strong>
              {order.item}
            </strong>

            <span>
              Ordered item
            </span>
          </div>

          <div className="detail-card">
            <div className="detail-card-title">
              <Database size={18} />
              Amount
            </div>

            <strong>
              ₹
              {Number(
                order.amount
              ).toLocaleString("en-IN")}
            </strong>

            <span>
              Order value
            </span>
          </div>

          <div className="detail-card">
            <div className="detail-card-title">
              <Truck size={18} />
              Expected delivery
            </div>

            <strong>
              {order.expected_delivery
                ? new Date(
                    order.expected_delivery
                  ).toLocaleDateString(
                    "en-IN",
                    {
                      day: "2-digit",
                      month: "short",
                      year: "numeric"
                    }
                  )
                : "Not available"}
            </strong>

            <span>
              Estimated delivery date
            </span>
          </div>

        </div>

        <div className="order-action-card">

          <div>
            <div className="detail-kicker">
              AI SUPPORT
            </div>

            <h3>
              Need help with this order?
            </h3>

            <p>
              Ask ResolveAI to analyze the current
              order information and answer your
              question.
            </p>
          </div>

          <button
            className="primary-action"
            onClick={() =>
              askAIAboutOrder(order)
            }
          >
            <Sparkles size={16} />
            Ask ResolveAI
            <ArrowUpRight size={14} />
          </button>

        </div>

        <div className="order-info-card">

          <div className="detail-card-title">
            <CircleHelp size={18} />
            What ResolveAI can help with
          </div>

          <div className="help-items">

            <span>
              <CheckCircle2 size={14} />
              Order status
            </span>

            <span>
              <CheckCircle2 size={14} />
              Delivery information
            </span>

            <span>
              <CheckCircle2 size={14} />
              Shipping questions
            </span>

            <span>
              <CheckCircle2 size={14} />
              Refund and cancellation policies
            </span>

          </div>

        </div>

      </div>
    );
  };

  // ==================================================
  // ORDERS
  // ==================================================

  const renderOrders = () => {
    if (selectedOrder) {
      return renderOrderDetail();
    }

    return (
      <div className="page-container">

        <div className="page-heading">

          <div>
            <h1>
              Order management
            </h1>

            <p>
              View live order information
              connected to MySQL.
            </p>
          </div>

          <button
            className="refresh-button"
            onClick={loadOrders}
            disabled={ordersLoading}
          >
            <RefreshCw
              size={14}
              className={
                ordersLoading
                  ? "spin"
                  : ""
              }
            />

            Refresh
          </button>

        </div>

        <div className="stats-grid">

          <div className="stat-card">
            <div className="stat-icon purple">
              <Package size={17} />
            </div>

            <div>
              <span>
                Total orders
              </span>

              <strong>
                {orders.length}
              </strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon blue">
              <Truck size={17} />
            </div>

            <div>
              <span>
                Shipped
              </span>

              <strong>
                {
                  orders.filter(
                    (o) =>
                      o.status === "Shipped"
                  ).length
                }
              </strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon green">
              <CheckCircle2 size={17} />
            </div>

            <div>
              <span>
                Delivered
              </span>

              <strong>
                {
                  orders.filter(
                    (o) =>
                      o.status === "Delivered"
                  ).length
                }
              </strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon orange">
              <Clock3 size={17} />
            </div>

            <div>
              <span>
                Processing
              </span>

              <strong>
                {
                  orders.filter(
                    (o) =>
                      o.status === "Processing"
                  ).length
                }
              </strong>
            </div>
          </div>

        </div>

        <div className="table-card">

          <div className="table-toolbar">

            <div className="table-title">
              <h3>
                Customer orders
              </h3>

              <span>
                {orders.length} records
              </span>
            </div>

            <div className="search-box">
              <Search size={14} />

              <input
                value={orderSearch}
                onChange={(event) =>
                  setOrderSearch(
                    event.target.value
                  )
                }
                placeholder="Search orders..."
              />
            </div>

          </div>

          {ordersLoading ? (
            <div className="empty-state">
              <Loader2 className="spinner" />
              Loading orders...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="empty-state">
              <Package size={25} />
              <span>
                No orders found.
              </span>
            </div>
          ) : (
            <div className="orders-table">

              <div className="table-header">
                <span>ORDER</span>
                <span>CUSTOMER</span>
                <span>ITEM</span>
                <span>AMOUNT</span>
                <span>STATUS</span>
                <span>DELIVERY</span>
              </div>

              {filteredOrders.map(
                (order) => (
                  <button
                    className="table-row"
                    key={order.order_id}
                    onClick={() =>
                      openOrder(order)
                    }
                  >
                    <strong>
                      {order.order_id}
                    </strong>

                    <span>
                      {order.customer_name}
                    </span>

                    <span>
                      {order.item}
                    </span>

                    <span>
                      ₹
                      {Number(
                        order.amount
                      ).toLocaleString(
                        "en-IN"
                      )}
                    </span>

                    <span>
                      <span
                        className={`status-badge ${
                          order.status.toLowerCase()
                        }`}
                      >
                        {getStatusIcon(
                          order.status
                        )}

                        {order.status}
                      </span>
                    </span>

                    <span className="delivery-date">
                      {order.expected_delivery
                        ? new Date(
                            order.expected_delivery
                          ).toLocaleDateString(
                            "en-IN",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric"
                            }
                          )
                        : "—"}
                    </span>
                  </button>
                )
              )}

            </div>
          )}

        </div>

      </div>
    );
  };

  // ==================================================
  // SUPPORT QUEUE
  // ==================================================

  const renderSupportQueue = () => (
    <div className="page-container">

      <div className="page-heading">

        <div>
          <h1>
            Support Queue
          </h1>

          <p>
            Review customer conversations that
            require human support.
          </p>
        </div>

        <button
          className="refresh-button"
          onClick={loadEscalations}
          disabled={escalationsLoading}
        >
          <RefreshCw
            size={14}
            className={
              escalationsLoading
                ? "spin"
                : ""
            }
          />

          Refresh
        </button>

      </div>

      <div className="stats-grid">

        <div className="stat-card">

          <div className="stat-icon orange">
            <Headphones size={17} />
          </div>

          <div>
            <span>
              Open cases
            </span>

            <strong>
              {escalations.length}
            </strong>
          </div>

        </div>

        <div className="stat-card">

          <div className="stat-icon purple">
            <MessageSquare size={17} />
          </div>

          <div>
            <span>
              Human escalations
            </span>

            <strong>
              {escalations.length}
            </strong>
          </div>

        </div>

      </div>

      <div className="table-card">

        <div className="table-toolbar">

          <div className="table-title">

            <h3>
              Escalated conversations
            </h3>

            <span>
              {escalations.length} cases
            </span>

          </div>

        </div>

        {escalationsLoading ? (
          <div className="empty-state">
            <Loader2 className="spinner" />
            Loading support cases...
          </div>
        ) : escalations.length === 0 ? (
          <div className="empty-state">
            <Headphones size={25} />

            <span>
              No escalated conversations.
            </span>
          </div>
        ) : (
          <div className="orders-table">

            <div className="table-header support-table-header">
              <span>ID</span>
              <span>SESSION</span>
              <span>CUSTOMER MESSAGE</span>
              <span>REASON</span>
              <span>STATUS</span>
              <span>CREATED</span>
            </div>

            {escalations.map(
              (item) => (
                <div
                  className="table-row support-table-row"
                  key={item.id}
                >
                  <strong>
                    #{item.id}
                  </strong>

                  <span>
                    {item.session_id}
                  </span>

                  <span>
                    {item.customer_message}
                  </span>

                  <span>
                    {item.reason}
                  </span>

                  <span>
                    <span className="status-badge open">
                      <Clock3 size={15} />
                      {item.status}
                    </span>
                  </span>

                  <span>
                    {new Date(
                      item.created_at
                    ).toLocaleString(
                      "en-IN"
                    )}
                  </span>
                </div>
              )
            )}

          </div>
        )}

      </div>

    </div>
  );

  // ==================================================
  // KNOWLEDGE BASE
  // ==================================================

  const renderKnowledge = () => (
    <div className="page-container">

      <div className="page-heading">

        <div>
          <h1>
            Knowledge base
          </h1>

          <p>
            Information used to ground
            ResolveAI responses.
          </p>
        </div>

        <div className="kb-status">
          <span></span>
          RAG active
        </div>

      </div>

      <div className="knowledge-layout">

        <div className="knowledge-main">

          <div className="document-card">

            <div className="document-icon">
              <FileText size={20} />
            </div>

            <div className="document-info">

              <h3>
                company_policies.txt
              </h3>

              <p>
                ResolveAI company policies
              </p>

              <div className="document-meta">
                <span>Refunds</span>
                <span>Shipping</span>
                <span>Payments</span>
                <span>Cancellations</span>
              </div>

            </div>

            <div className="indexed">
              <CheckCircle2 size={14} />
              Indexed
            </div>

          </div>

          <div className="document-preview">

            <div className="preview-header">
              <div>
                <h3>
                  Document preview
                </h3>

                <p>
                  Source used by the RAG pipeline
                </p>
              </div>
            </div>

            <div className="preview-content">

              <h4>
                RESOLVEAI COMPANY POLICIES
              </h4>

              <h5>
                REFUND POLICY
              </h5>

              <p>
                Customers can request a refund
                within 7 days of delivery.
              </p>

              <p>
                Products must be unused and
                returned in their original packaging.
              </p>

              <p>
                Approved refunds are normally
                processed within 5–7 business days.
              </p>

              <h5>
                SHIPPING POLICY
              </h5>

              <p>
                Standard shipping usually takes
                3–5 business days.
              </p>

              <p>
                Express shipping usually takes
                1–2 business days.
              </p>

              <h5>
                CANCELLATION POLICY
              </h5>

              <p>
                Orders can normally be cancelled
                while their status is Processing.
              </p>

              <p>
                Orders that have already been shipped
                cannot normally be cancelled.
              </p>

            </div>

          </div>

        </div>

        <div className="rag-card">

          <div className="rag-card-header">

            <div className="rag-icon">
              <Sparkles size={16} />
            </div>

            <div>
              <h3>
                Retrieval pipeline
              </h3>

              <p>
                Current RAG configuration
              </p>
            </div>

          </div>

          <div className="pipeline">

            <div className="pipeline-step">
              <span>01</span>

              <div>
                <strong>
                  User query
                </strong>

                <small>
                  Customer question
                </small>
              </div>
            </div>

            <div className="pipeline-line"></div>

            <div className="pipeline-step">
              <span>02</span>

              <div>
                <strong>
                  Gemini embedding
                </strong>

                <small>
                  Semantic representation
                </small>
              </div>
            </div>

            <div className="pipeline-line"></div>

            <div className="pipeline-step">
              <span>03</span>

              <div>
                <strong>
                  Vector search
                </strong>

                <small>
                  ChromaDB
                </small>
              </div>
            </div>

            <div className="pipeline-line"></div>

            <div className="pipeline-step">
              <span>04</span>

              <div>
                <strong>
                  Grounded answer
                </strong>

                <small>
                  Gemini 2.5 Flash
                </small>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );

  // ==================================================
  // SETTINGS
  // ==================================================

  const renderSettings = () => (
    <div className="page-container">

      <div className="page-heading">

        <div>
          <h1>
            Settings
          </h1>

          <p>
            Configure your ResolveAI workspace.
          </p>
        </div>

      </div>

      <div className="settings-grid">

        <div className="settings-card">

          <div className="settings-card-icon">
            <Cpu size={18} />
          </div>

          <div>
            <h3>
              AI Model
            </h3>

            <p>
              Gemini 2.5 Flash
            </p>

            <span className="connected">
              ● Connected
            </span>
          </div>

        </div>

        <div className="settings-card">

          <div className="settings-card-icon">
            <Database size={18} />
          </div>

          <div>
            <h3>
              Database
            </h3>

            <p>
              MySQL · resolveai
            </p>

            <span className="connected">
              ● Connected
            </span>
          </div>

        </div>

        <div className="settings-card">

          <div className="settings-card-icon">
            <BookOpen size={18} />
          </div>

          <div>
            <h3>
              Vector Store
            </h3>

            <p>
              ChromaDB
            </p>

            <span className="connected">
              ● Connected
            </span>
          </div>

        </div>

        <div className="settings-card">

          <div className="settings-card-icon">
            <Server size={18} />
          </div>

          <div>
            <h3>
              API Server
            </h3>

            <p>
              FastAPI · localhost:8000
            </p>

            <span className="connected">
              ● Online
            </span>
          </div>

        </div>

      </div>

      <div className="settings-options">

        <div className="setting-row">

          <div>
            <strong>
              Notifications
            </strong>

            <span>
              Receive support workspace
              notifications.
            </span>
          </div>

          <button
            className={`toggle ${
              notificationsEnabled
                ? "on"
                : ""
            }`}
            onClick={() =>
              setNotificationsEnabled(
                !notificationsEnabled
              )
            }
          >
            <span></span>
          </button>

        </div>

        <div className="setting-row">

          <div>
            <strong>
              Automatic order refresh
            </strong>

            <span>
              Refresh order data every
              30 seconds.
            </span>
          </div>

          <button
            className={`toggle ${
              autoRefresh
                ? "on"
                : ""
            }`}
            onClick={() =>
              setAutoRefresh(
                !autoRefresh
              )
            }
          >
            <span></span>
          </button>

        </div>

      </div>

      <div className="architecture-card">

        <div>
          <h3>
            ResolveAI architecture
          </h3>

          <p>
            Current local development stack
          </p>
        </div>

        <div className="architecture-flow">

          <span>React</span>
          <b>→</b>
          <span>FastAPI</span>
          <b>→</b>
          <span>Gemini</span>
          <b>→</b>
          <span>MySQL / RAG</span>
          <b>→</b>
          <span>Redis</span>

        </div>

      </div>

    </div>
  );

  // ==================================================
  // INPUT
  // ==================================================

  const renderInput = () => {
    if (activePage !== "assistant") {
      return null;
    }

    return (
      <div className="input-section">

        <div className="input-container">

          <div className="input-wrapper">

            <textarea
              value={input}
              onChange={(event) =>
                setInput(event.target.value)
              }
              onKeyDown={handleKeyDown}
              placeholder="Message ResolveAI..."
              rows={1}
            />

            <button
              className="send-button"
              onClick={() =>
                sendMessage()
              }
              disabled={
                !input.trim() ||
                loading
              }
            >
              <Send size={17} />
            </button>

          </div>

          <div className="input-footer">

            <span>
              ResolveAI may make mistakes.
              Verify important information.
            </span>

            <span className="powered">
              Powered by Gemini
            </span>

          </div>

        </div>

      </div>
    );
  };

  // ==================================================
  // PAGE CONTENT
  // ==================================================

  const renderPage = () => {

    if (activePage === "orders") {
      return renderOrders();
    }

    if (activePage === "support") {
      return renderSupportQueue();
    }

    if (activePage === "knowledge") {
      return renderKnowledge();
    }

    if (activePage === "settings") {
      return renderSettings();
    }

    return renderAssistant();
  };

  // ==================================================
  // MAIN APP
  // ==================================================

  return (
    <div className="app">

      {renderSidebar()}

      <main className="main">

        {renderHeader()}

        {renderPage()}

        {renderInput()}

      </main>

    </div>
  );
}

export default App;