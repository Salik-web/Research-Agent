import streamlit as st
import os
import uuid
import time
import re
from dotenv import load_dotenv

# Load environment variables before importing anything else
load_dotenv()

from main import build_graph

# --- PAGE CONFIG ---
st.set_page_config(page_title="Research Agent", page_icon="🔍", layout="wide")

# --- CUSTOM CSS ---
st.markdown(
    """
<style>
    /* Dark Theme Basics */
    .stApp {
        background-color: #0e1117;
        color: #fafafa;
        font-family: 'Inter', sans-serif;
    }
    
    /* User Chat Bubble Alignment (Right) */
    div[data-testid="stChatMessage"]:has(div[data-testid="chatAvatarIcon-user"]) {
        flex-direction: row-reverse;
        background-color: #2b313e;
        border-radius: 15px;
        padding: 10px;
        margin: 10px 0;
    }
    div[data-testid="stChatMessage"]:has(div[data-testid="chatAvatarIcon-user"]) .stMarkdown {
        text-align: right;
    }
    
    /* Assistant Chat Bubble Alignment (Left) */
    div[data-testid="stChatMessage"]:has(div[data-testid="chatAvatarIcon-assistant"]) {
        background-color: #1a1c23;
        border-radius: 15px;
        padding: 10px;
        margin: 10px 0;
        border: 1px solid #333;
    }
</style>
""",
    unsafe_allow_html=True,
)

# --- SESSION STATE INITIALIZATION ---
if "thread_id" not in st.session_state:
    st.session_state.thread_id = str(uuid.uuid4())
if "messages" not in st.session_state:
    st.session_state.messages = []
if "graph" not in st.session_state:
    st.session_state.graph = build_graph()
if "pending_review" not in st.session_state:
    st.session_state.pending_review = False

config = {"configurable": {"thread_id": st.session_state.thread_id}}


# --- STREAMING HELPER ---
def stream_report_text(report_text):
    """
    Generator that yields the report word-by-word for a typewriter effect.
    Filters out <think>...</think> blocks from Qwen3 models.
    """
    # Strip all <think>...</think> blocks (including multiline)
    cleaned = re.sub(r"<think>.*?</think>", "", report_text, flags=re.DOTALL).strip()
    # Also handle case where </think> exists without opening tag
    if "</think>" in cleaned:
        cleaned = cleaned.split("</think>")[-1].strip()

    words = cleaned.split(" ")
    for i, word in enumerate(words):
        yield word + (" " if i < len(words) - 1 else "")
        time.sleep(0.02)


# --- SIDEBAR ---
with st.sidebar:
    st.title("🔍 Research Agent")
    if st.button("New Chat ➕", use_container_width=True):
        st.session_state.thread_id = str(uuid.uuid4())
        st.session_state.messages = []
        st.session_state.pending_review = False
        st.rerun()

    st.divider()

    st.subheader("📄 Knowledge Base")
    os.makedirs("./documents", exist_ok=True)

    uploaded_file = st.file_uploader("Upload PDF", type=["pdf"])
    if uploaded_file is not None:
        file_path = os.path.join("./documents", uploaded_file.name)
        with open(file_path, "wb") as f:
            f.write(uploaded_file.getbuffer())
        st.success(f"Saved {uploaded_file.name}!")

    st.write("**Uploaded Documents:**")
    docs = os.listdir("./documents")
    if docs:
        for doc in docs:
            st.caption(f"- {doc}")
    else:
        st.caption("No documents uploaded yet.")


# --- MAIN CHAT AREA ---
st.title("Research Agent")

# Render History
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# Render Pending Review UI
if st.session_state.pending_review:
    state = st.session_state.graph.get_state(config)
    summarized = state.values.get("summarized_result", "")

    with st.chat_message("assistant"):
        st.markdown("### 🧠 Research Findings So Far")
        st.info(summarized)
        st.write(
            "**Do you want to generate the final report, or search the web for more information?**"
        )

        col1, col2 = st.columns(2)
        with col1:
            if st.button(
                "📄 Generate Report", type="primary", use_container_width=True
            ):
                st.session_state.graph.update_state(config, {"human_approved": True})
                st.session_state.pending_review = False

                with st.spinner("Agent is working..."):
                    result = st.session_state.graph.invoke(None, config)

                # Check if we hit another interrupt
                new_state = st.session_state.graph.get_state(config)
                if new_state.next and new_state.next[0] == "human_review":
                    st.session_state.pending_review = True
                elif "final_report" in result:
                    st.session_state.messages.append(
                        {"role": "assistant", "content": result["final_report"]}
                    )
                st.rerun()

        with col2:
            if st.button("🔍 Search More", use_container_width=True):
                st.session_state.graph.update_state(config, {"human_approved": False})
                st.session_state.pending_review = False

                with st.spinner("Agent is working..."):
                    result = st.session_state.graph.invoke(None, config)

                # Check if we hit another interrupt
                new_state = st.session_state.graph.get_state(config)
                if new_state.next and new_state.next[0] == "human_review":
                    st.session_state.pending_review = True
                elif "final_report" in result:
                    st.session_state.messages.append(
                        {"role": "assistant", "content": result["final_report"]}
                    )
                st.rerun()

# --- CHAT INPUT ---
# Only show input if not waiting for human review
if not st.session_state.pending_review:
    prompt = st.chat_input("What would you like to research?")
    if prompt:
        # Add user message to UI
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        # Run graph with a spinner
        initial_state = {
            "query": prompt,
            "iterations": 0,
            "human_approved": False,
            "messages": [],
        }
        with st.spinner("Agent is working..."):
            result = st.session_state.graph.invoke(initial_state, config=config)

        # Check if we hit the human review interrupt
        state = st.session_state.graph.get_state(config)
        if state.next and state.next[0] == "human_review":
            st.session_state.pending_review = True
            st.rerun()
        elif "final_report" in result:
            # Stream the report word-by-word with typewriter effect
            with st.chat_message("assistant"):
                st.write_stream(stream_report_text(result["final_report"]))
            st.session_state.messages.append(
                {"role": "assistant", "content": result["final_report"]}
            )
            st.rerun()
