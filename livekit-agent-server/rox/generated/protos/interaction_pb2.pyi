from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Iterable as _Iterable, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class ClientUIActionType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    NO_ACTION: _ClassVar[ClientUIActionType]
    SHOW_ALERT: _ClassVar[ClientUIActionType]
    UPDATE_TEXT_CONTENT: _ClassVar[ClientUIActionType]
    TOGGLE_ELEMENT_VISIBILITY: _ClassVar[ClientUIActionType]
    START_TIMER: _ClassVar[ClientUIActionType]
    STOP_TIMER: _ClassVar[ClientUIActionType]
    PAUSE_TIMER: _ClassVar[ClientUIActionType]
    RESET_TIMER: _ClassVar[ClientUIActionType]
    UPDATE_PROGRESS_INDICATOR: _ClassVar[ClientUIActionType]
    UPDATE_SCORE_OR_PROGRESS: _ClassVar[ClientUIActionType]
    SHOW_ELEMENT: _ClassVar[ClientUIActionType]
    HIDE_ELEMENT: _ClassVar[ClientUIActionType]
    NAVIGATE_TO_PAGE: _ClassVar[ClientUIActionType]
    UPDATE_LIVE_TRANSCRIPT: _ClassVar[ClientUIActionType]
    DISPLAY_TRANSCRIPT_OR_TEXT: _ClassVar[ClientUIActionType]
    DISPLAY_REMARKS_LIST: _ClassVar[ClientUIActionType]
    SET_BUTTON_PROPERTIES: _ClassVar[ClientUIActionType]
    ENABLE_BUTTON: _ClassVar[ClientUIActionType]
    DISABLE_BUTTON: _ClassVar[ClientUIActionType]
    SHOW_BUTTON_OPTIONS: _ClassVar[ClientUIActionType]
    CLEAR_INPUT_FIELD: _ClassVar[ClientUIActionType]
    SET_EDITOR_READONLY_SECTIONS: _ClassVar[ClientUIActionType]
    SHOW_LOADING_INDICATOR: _ClassVar[ClientUIActionType]
    HIGHLIGHT_TEXT_RANGES: _ClassVar[ClientUIActionType]
    SUGGEST_TEXT_EDIT: _ClassVar[ClientUIActionType]
    SHOW_INLINE_SUGGESTION: _ClassVar[ClientUIActionType]
    SHOW_TOOLTIP_OR_COMMENT: _ClassVar[ClientUIActionType]
    SET_EDITOR_CONTENT: _ClassVar[ClientUIActionType]
    APPEND_TEXT_TO_EDITOR_REALTIME: _ClassVar[ClientUIActionType]
NO_ACTION: ClientUIActionType
SHOW_ALERT: ClientUIActionType
UPDATE_TEXT_CONTENT: ClientUIActionType
TOGGLE_ELEMENT_VISIBILITY: ClientUIActionType
START_TIMER: ClientUIActionType
STOP_TIMER: ClientUIActionType
PAUSE_TIMER: ClientUIActionType
RESET_TIMER: ClientUIActionType
UPDATE_PROGRESS_INDICATOR: ClientUIActionType
UPDATE_SCORE_OR_PROGRESS: ClientUIActionType
SHOW_ELEMENT: ClientUIActionType
HIDE_ELEMENT: ClientUIActionType
NAVIGATE_TO_PAGE: ClientUIActionType
UPDATE_LIVE_TRANSCRIPT: ClientUIActionType
DISPLAY_TRANSCRIPT_OR_TEXT: ClientUIActionType
DISPLAY_REMARKS_LIST: ClientUIActionType
SET_BUTTON_PROPERTIES: ClientUIActionType
ENABLE_BUTTON: ClientUIActionType
DISABLE_BUTTON: ClientUIActionType
SHOW_BUTTON_OPTIONS: ClientUIActionType
CLEAR_INPUT_FIELD: ClientUIActionType
SET_EDITOR_READONLY_SECTIONS: ClientUIActionType
SHOW_LOADING_INDICATOR: ClientUIActionType
HIGHLIGHT_TEXT_RANGES: ClientUIActionType
SUGGEST_TEXT_EDIT: ClientUIActionType
SHOW_INLINE_SUGGESTION: ClientUIActionType
SHOW_TOOLTIP_OR_COMMENT: ClientUIActionType
SET_EDITOR_CONTENT: ClientUIActionType
APPEND_TEXT_TO_EDITOR_REALTIME: ClientUIActionType

class Empty(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class FrontendButtonClickRequest(_message.Message):
    __slots__ = ("button_id", "custom_data")
    BUTTON_ID_FIELD_NUMBER: _ClassVar[int]
    CUSTOM_DATA_FIELD_NUMBER: _ClassVar[int]
    button_id: str
    custom_data: str
    def __init__(self, button_id: _Optional[str] = ..., custom_data: _Optional[str] = ...) -> None: ...

class AgentResponse(_message.Message):
    __slots__ = ("status_message", "data_payload")
    STATUS_MESSAGE_FIELD_NUMBER: _ClassVar[int]
    DATA_PAYLOAD_FIELD_NUMBER: _ClassVar[int]
    status_message: str
    data_payload: str
    def __init__(self, status_message: _Optional[str] = ..., data_payload: _Optional[str] = ...) -> None: ...

class UIAction(_message.Message):
    __slots__ = ("action_type", "alert")
    class ActionType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
        __slots__ = ()
        UNSPECIFIED: _ClassVar[UIAction.ActionType]
        ALERT: _ClassVar[UIAction.ActionType]
        DISMISS_ALERT: _ClassVar[UIAction.ActionType]
    UNSPECIFIED: UIAction.ActionType
    ALERT: UIAction.ActionType
    DISMISS_ALERT: UIAction.ActionType
    ACTION_TYPE_FIELD_NUMBER: _ClassVar[int]
    ALERT_FIELD_NUMBER: _ClassVar[int]
    action_type: UIAction.ActionType
    alert: Alert
    def __init__(self, action_type: _Optional[_Union[UIAction.ActionType, str]] = ..., alert: _Optional[_Union[Alert, _Mapping]] = ...) -> None: ...

class Alert(_message.Message):
    __slots__ = ("title", "message", "buttons")
    TITLE_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    BUTTONS_FIELD_NUMBER: _ClassVar[int]
    title: str
    message: str
    buttons: _containers.RepeatedCompositeFieldContainer[AlertButton]
    def __init__(self, title: _Optional[str] = ..., message: _Optional[str] = ..., buttons: _Optional[_Iterable[_Union[AlertButton, _Mapping]]] = ...) -> None: ...

class AlertButton(_message.Message):
    __slots__ = ("label", "action")
    LABEL_FIELD_NUMBER: _ClassVar[int]
    ACTION_FIELD_NUMBER: _ClassVar[int]
    label: str
    action: UIAction
    def __init__(self, label: _Optional[str] = ..., action: _Optional[_Union[UIAction, _Mapping]] = ...) -> None: ...

class HighlightRangeProto(_message.Message):
    __slots__ = ("id", "start", "end", "type", "message", "wrong_version", "correct_version")
    ID_FIELD_NUMBER: _ClassVar[int]
    START_FIELD_NUMBER: _ClassVar[int]
    END_FIELD_NUMBER: _ClassVar[int]
    TYPE_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    WRONG_VERSION_FIELD_NUMBER: _ClassVar[int]
    CORRECT_VERSION_FIELD_NUMBER: _ClassVar[int]
    id: str
    start: int
    end: int
    type: str
    message: str
    wrong_version: str
    correct_version: str
    def __init__(self, id: _Optional[str] = ..., start: _Optional[int] = ..., end: _Optional[int] = ..., type: _Optional[str] = ..., message: _Optional[str] = ..., wrong_version: _Optional[str] = ..., correct_version: _Optional[str] = ...) -> None: ...

class SuggestTextEditPayloadProto(_message.Message):
    __slots__ = ("suggestion_id", "start_pos", "end_pos", "original_text", "new_text")
    SUGGESTION_ID_FIELD_NUMBER: _ClassVar[int]
    START_POS_FIELD_NUMBER: _ClassVar[int]
    END_POS_FIELD_NUMBER: _ClassVar[int]
    ORIGINAL_TEXT_FIELD_NUMBER: _ClassVar[int]
    NEW_TEXT_FIELD_NUMBER: _ClassVar[int]
    suggestion_id: str
    start_pos: int
    end_pos: int
    original_text: str
    new_text: str
    def __init__(self, suggestion_id: _Optional[str] = ..., start_pos: _Optional[int] = ..., end_pos: _Optional[int] = ..., original_text: _Optional[str] = ..., new_text: _Optional[str] = ...) -> None: ...

class ShowInlineSuggestionPayloadProto(_message.Message):
    __slots__ = ("suggestion_id", "start_pos", "end_pos", "suggestion_text", "suggestion_type")
    SUGGESTION_ID_FIELD_NUMBER: _ClassVar[int]
    START_POS_FIELD_NUMBER: _ClassVar[int]
    END_POS_FIELD_NUMBER: _ClassVar[int]
    SUGGESTION_TEXT_FIELD_NUMBER: _ClassVar[int]
    SUGGESTION_TYPE_FIELD_NUMBER: _ClassVar[int]
    suggestion_id: str
    start_pos: int
    end_pos: int
    suggestion_text: str
    suggestion_type: str
    def __init__(self, suggestion_id: _Optional[str] = ..., start_pos: _Optional[int] = ..., end_pos: _Optional[int] = ..., suggestion_text: _Optional[str] = ..., suggestion_type: _Optional[str] = ...) -> None: ...

class ShowTooltipOrCommentPayloadProto(_message.Message):
    __slots__ = ("id", "start_pos", "end_pos", "text", "tooltip_type")
    ID_FIELD_NUMBER: _ClassVar[int]
    START_POS_FIELD_NUMBER: _ClassVar[int]
    END_POS_FIELD_NUMBER: _ClassVar[int]
    TEXT_FIELD_NUMBER: _ClassVar[int]
    TOOLTIP_TYPE_FIELD_NUMBER: _ClassVar[int]
    id: str
    start_pos: int
    end_pos: int
    text: str
    tooltip_type: str
    def __init__(self, id: _Optional[str] = ..., start_pos: _Optional[int] = ..., end_pos: _Optional[int] = ..., text: _Optional[str] = ..., tooltip_type: _Optional[str] = ...) -> None: ...

class SetEditorContentPayloadProto(_message.Message):
    __slots__ = ("html_content", "json_content")
    HTML_CONTENT_FIELD_NUMBER: _ClassVar[int]
    JSON_CONTENT_FIELD_NUMBER: _ClassVar[int]
    html_content: str
    json_content: str
    def __init__(self, html_content: _Optional[str] = ..., json_content: _Optional[str] = ...) -> None: ...

class AppendTextToEditorRealtimePayloadProto(_message.Message):
    __slots__ = ("text_chunk", "stream_id", "is_final_chunk")
    TEXT_CHUNK_FIELD_NUMBER: _ClassVar[int]
    STREAM_ID_FIELD_NUMBER: _ClassVar[int]
    IS_FINAL_CHUNK_FIELD_NUMBER: _ClassVar[int]
    text_chunk: str
    stream_id: str
    is_final_chunk: bool
    def __init__(self, text_chunk: _Optional[str] = ..., stream_id: _Optional[str] = ..., is_final_chunk: bool = ...) -> None: ...

class AgentToClientUIActionRequest(_message.Message):
    __slots__ = ("request_id", "action_type", "target_element_id", "parameters", "highlight_ranges_payload", "suggest_text_edit_payload", "show_inline_suggestion_payload", "show_tooltip_or_comment_payload", "set_editor_content_payload", "append_text_to_editor_realtime_payload")
    class ParametersEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    REQUEST_ID_FIELD_NUMBER: _ClassVar[int]
    ACTION_TYPE_FIELD_NUMBER: _ClassVar[int]
    TARGET_ELEMENT_ID_FIELD_NUMBER: _ClassVar[int]
    PARAMETERS_FIELD_NUMBER: _ClassVar[int]
    HIGHLIGHT_RANGES_PAYLOAD_FIELD_NUMBER: _ClassVar[int]
    SUGGEST_TEXT_EDIT_PAYLOAD_FIELD_NUMBER: _ClassVar[int]
    SHOW_INLINE_SUGGESTION_PAYLOAD_FIELD_NUMBER: _ClassVar[int]
    SHOW_TOOLTIP_OR_COMMENT_PAYLOAD_FIELD_NUMBER: _ClassVar[int]
    SET_EDITOR_CONTENT_PAYLOAD_FIELD_NUMBER: _ClassVar[int]
    APPEND_TEXT_TO_EDITOR_REALTIME_PAYLOAD_FIELD_NUMBER: _ClassVar[int]
    request_id: str
    action_type: ClientUIActionType
    target_element_id: str
    parameters: _containers.ScalarMap[str, str]
    highlight_ranges_payload: _containers.RepeatedCompositeFieldContainer[HighlightRangeProto]
    suggest_text_edit_payload: SuggestTextEditPayloadProto
    show_inline_suggestion_payload: ShowInlineSuggestionPayloadProto
    show_tooltip_or_comment_payload: ShowTooltipOrCommentPayloadProto
    set_editor_content_payload: SetEditorContentPayloadProto
    append_text_to_editor_realtime_payload: AppendTextToEditorRealtimePayloadProto
    def __init__(self, request_id: _Optional[str] = ..., action_type: _Optional[_Union[ClientUIActionType, str]] = ..., target_element_id: _Optional[str] = ..., parameters: _Optional[_Mapping[str, str]] = ..., highlight_ranges_payload: _Optional[_Iterable[_Union[HighlightRangeProto, _Mapping]]] = ..., suggest_text_edit_payload: _Optional[_Union[SuggestTextEditPayloadProto, _Mapping]] = ..., show_inline_suggestion_payload: _Optional[_Union[ShowInlineSuggestionPayloadProto, _Mapping]] = ..., show_tooltip_or_comment_payload: _Optional[_Union[ShowTooltipOrCommentPayloadProto, _Mapping]] = ..., set_editor_content_payload: _Optional[_Union[SetEditorContentPayloadProto, _Mapping]] = ..., append_text_to_editor_realtime_payload: _Optional[_Union[AppendTextToEditorRealtimePayloadProto, _Mapping]] = ...) -> None: ...

class ClientUIActionResponse(_message.Message):
    __slots__ = ("request_id", "success", "message")
    REQUEST_ID_FIELD_NUMBER: _ClassVar[int]
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    request_id: str
    success: bool
    message: str
    def __init__(self, request_id: _Optional[str] = ..., success: bool = ..., message: _Optional[str] = ...) -> None: ...
