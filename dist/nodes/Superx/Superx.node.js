"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Superx = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const http_1 = require("../../shared/http");
function normalizeParameterValue(value) {
    if (value && typeof value === 'object' && 'value' in value)
        return value.value;
    return value;
}
function normalizeJsonValue(value, label, context, itemIndex) {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return {};
        try {
            return JSON.parse(trimmed);
        }
        catch (error) {
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${label} must be valid JSON: ${error.message}`, { itemIndex });
        }
    }
    if (value === null || Array.isArray(value) || (value && typeof value === 'object') || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
        return value;
    throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${label} must be valid JSON`, { itemIndex });
}
function validateBodyValue(value, contract, path, context, itemIndex) {
    var _a, _b, _c, _d, _e;
    if (value === undefined || value === '') {
        if (contract.required)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} is required`, { itemIndex });
        return;
    }
    if (value === null) {
        if (contract.nullable)
            return;
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must not be null`, { itemIndex });
    }
    if ((_a = contract.alternatives) === null || _a === void 0 ? void 0 : _a.length) {
        selectAlternativeValue(value, contract, path, context, itemIndex);
        return;
    }
    if (contract.type === 'string' && typeof value !== 'string')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a string`, { itemIndex });
    if (contract.type === 'boolean' && typeof value !== 'boolean')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a boolean`, { itemIndex });
    if (contract.type === 'number' && typeof value !== 'number')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a number`, { itemIndex });
    if (contract.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value)))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be an integer`, { itemIndex });
    if ((_b = contract.enum) === null || _b === void 0 ? void 0 : _b.length) {
        const enumValueMatches = (candidate) => candidate === value ||
            (candidate === null && value === 'null') ||
            (candidate === 'null' && value === null) ||
            Boolean(candidate && value && typeof candidate === 'object' && typeof value === 'object' && JSON.stringify(candidate) === JSON.stringify(value));
        const scalarEnum = contract.enum.every((candidate) => candidate === null || ['string', 'number', 'boolean'].includes(typeof candidate));
        const matches = contract.type === 'array' && Array.isArray(value) && scalarEnum
            ? value.every((item) => contract.enum.some((candidate) => candidate === item || (candidate === null && item === 'null') || (candidate === 'null' && item === null)))
            : contract.enum.some(enumValueMatches);
        if (!matches)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be one of: ${contract.enum.join(', ')}`, { itemIndex });
    }
    if (contract.type === 'number' || contract.type === 'integer') {
        const numeric = value;
        if (contract.minValue !== undefined && numeric < contract.minValue)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be at least ${contract.minValue}`, { itemIndex });
        if (contract.maxValue !== undefined && numeric > contract.maxValue)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be at most ${contract.maxValue}`, { itemIndex });
    }
    if (contract.pattern && typeof value === 'string' && !new RegExp(contract.pattern).test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must match ${contract.pattern}`, { itemIndex });
    if (contract.format === 'email' && typeof value === 'string' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be an email address`, { itemIndex });
    if ((contract.format === 'uri' || contract.format === 'url') && typeof value === 'string') {
        try {
            new URL(value);
        }
        catch {
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a URL`, { itemIndex });
        }
    }
    if (contract.format === 'uuid' && typeof value === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a UUID`, { itemIndex });
    if (contract.type === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a JSON object`, { itemIndex });
        const objectValue = value;
        for (const child of (_c = contract.fields) !== null && _c !== void 0 ? _c : [])
            validateBodyValue(objectValue[child.name], child, `${path}.${child.name}`, context, itemIndex);
        if (contract.additionalValue) {
            const known = new Set(((_d = contract.fields) !== null && _d !== void 0 ? _d : []).map((field) => field.name));
            for (const [key, childValue] of Object.entries(objectValue)) {
                if (!known.has(key)) {
                    if (((_e = contract.additionalValue.alternatives) === null || _e === void 0 ? void 0 : _e.length) && contract.additionalValue.representation === 'raw')
                        continue;
                    validateBodyValue(childValue, contract.additionalValue, `${path}.${key}`, context, itemIndex);
                }
            }
        }
    }
    if (contract.type === 'array') {
        if (!Array.isArray(value))
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a JSON array`, { itemIndex });
        if (contract.items)
            value.forEach((item, index) => validateBodyValue(item, contract.items, `${path}[${index}]`, context, itemIndex));
    }
}
function setBodyField(body, contract, value, context, itemIndex) {
    var _a, _b;
    const normalized = contract.type === 'object' || contract.type === 'array' || contract.type === 'alternative' || contract.representation === 'raw'
        ? normalizeJsonValue(value, (_a = contract.displayName) !== null && _a !== void 0 ? _a : contract.name, context, itemIndex)
        : normalizeParameterValue(value);
    const selected = ((_b = contract.alternatives) === null || _b === void 0 ? void 0 : _b.length) ? selectAlternativeValue(normalized, contract, contract.name, context, itemIndex) : normalized;
    validateBodyValue(selected, { ...contract, alternatives: undefined, composition: undefined }, contract.name, context, itemIndex);
    body[contract.name] = selected;
}
function selectAlternativeValue(value, contract, path, context, itemIndex) {
    var _a, _b, _c;
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must include an explicit schema alternative and value`, { itemIndex });
    const selectedName = String((_a = value.schemaAlternative) !== null && _a !== void 0 ? _a : '');
    const selected = ((_b = contract.alternatives) !== null && _b !== void 0 ? _b : []).find((alternative) => alternative.name === selectedName);
    if (!selected)
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} schema alternative must be one of: ${((_c = contract.alternatives) !== null && _c !== void 0 ? _c : []).map((alternative) => alternative.name).join(', ')}`, { itemIndex });
    const selectedValue = value.value;
    validateBodyValue(selectedValue, selected, path, context, itemIndex);
    return selectedValue;
}
function selectResponseFields(value, fields) {
    if (fields.length === 0)
        return value;
    const selected = {};
    if (value.id !== undefined)
        selected.id = value.id;
    for (const field of fields)
        if (value[field] !== undefined)
            selected[field] = value[field];
    return selected;
}
function valueAtPath(value, path) {
    if (!path)
        return value;
    return path.split('.').filter(Boolean).reduce((current, segment) => {
        if (current === undefined || current === null)
            return undefined;
        if (Array.isArray(current))
            return current[Number(segment)];
        return current[segment];
    }, value);
}
class Superx {
    constructor() {
        this.description = {
            displayName: "SuperX",
            name: "superx",
            icon: {
                light: "file:superx.svg",
                dark: "file:superx.dark.svg"
            },
            group: [],
            version: [
                1
            ],
            subtitle: "={{((JSON.parse(\"\\u007b\\\"analytics\\\":\\u007b\\\"getPostAnalytics\\\":\\\"getAnalytics: analytic\\\"\\u007d,\\\"articles\\\":\\u007b\\\"createArticle\\\":\\\"createAnArticleDraft: article\\\",\\\"deleteArticle\\\":\\\"deleteAnArticle: article\\\",\\\"generateArticleCover\\\":\\\"generateAnAiCoverImage: article\\\",\\\"getArticle\\\":\\\"getAnArticle: article\\\",\\\"listArticles\\\":\\\"listArticles: article\\\",\\\"listCoverStyles\\\":\\\"listSavedCoverStyles: article\\\",\\\"publishArticle\\\":\\\"publishAnArticleToXNow: article\\\",\\\"scheduleArticle\\\":\\\"scheduleOrRescheduleAnArticle: article\\\",\\\"unscheduleArticle\\\":\\\"unscheduleAnArticle: article\\\",\\\"updateArticle\\\":\\\"editAnArticle: article\\\"\\u007d,\\\"audience\\\":\\u007b\\\"createContactNote\\\":\\\"addANoteToAContact: audience\\\",\\\"deleteContactNote\\\":\\\"deleteANoteOnAContact: audience\\\",\\\"getAudience\\\":\\\"readAnAudienceList: audience\\\",\\\"getContact\\\":\\\"getOneContact: audience\\\",\\\"listContactNotes\\\":\\\"listNotesOnAContact: audience\\\",\\\"listContactReplies\\\":\\\"listOneContactSRepliesToYou: audience\\\",\\\"listContacts\\\":\\\"listEngagedContacts: audience\\\",\\\"listReceivedReplies\\\":\\\"listRepliesYouReceived: audience\\\",\\\"updateContactNote\\\":\\\"editANoteOnAContact: audience\\\"\\u007d,\\\"contactLists\\\":\\u007b\\\"addContactListMember\\\":\\\"addAContactListMember: contactList\\\",\\\"addContactListMembers\\\":\\\"addContactListMembersInBulk: contactList\\\",\\\"createContactList\\\":\\\"createAContactList: contactList\\\",\\\"deleteContactList\\\":\\\"deleteAContactList: contactList\\\",\\\"listContactListMembers\\\":\\\"listContactListMembers: contactList\\\",\\\"listContactLists\\\":\\\"listContactLists: contactList\\\",\\\"removeContactListMember\\\":\\\"removeAContactListMember: contactList\\\",\\\"removeContactListMembers\\\":\\\"removeContactListMembersInBulk: contactList\\\",\\\"renameContactList\\\":\\\"renameAContactList: contactList\\\"\\u007d,\\\"content\\\":\\u007b\\\"listPosts\\\":\\\"listPublishedPosts: content\\\",\\\"listReplies\\\":\\\"listRepliesYouSent: content\\\"\\u007d,\\\"context\\\":\\u007b\\\"deleteContextProduct\\\":\\\"removeOneProduct: context\\\",\\\"getContext\\\":\\\"getContextSettings: context\\\",\\\"regenerateStyleGuide\\\":\\\"rebuildTheGeneratedStyleGuide: context\\\",\\\"scrapeContextProduct\\\":\\\"refreshAProductFromItsPage: context\\\",\\\"setContextProducts\\\":\\\"replaceTheProductList: context\\\",\\\"updateContext\\\":\\\"updateContextSettings: context\\\",\\\"updateContextProduct\\\":\\\"addOrEditOneProduct: context\\\"\\u007d,\\\"datasets\\\":\\u007b\\\"addDatasetToContacts\\\":\\\"addADatasetSPeopleToAContactList: dataset\\\",\\\"createDataset\\\":\\\"collectAnAudienceIntoADataset: dataset\\\",\\\"draftDatasetOutreach\\\":\\\"draftOutreachMessagesOntoAResearchDataset: dataset\\\",\\\"exportDataset\\\":\\\"exportADatasetAsCsv: dataset\\\",\\\"getDataset\\\":\\\"getADataset: dataset\\\",\\\"getDatasetRows\\\":\\\"getDatasetRows: dataset\\\",\\\"listDatasets\\\":\\\"listDatasets: dataset\\\",\\\"refineDataset\\\":\\\"refineADatasetByWhatEachPersonWrote: dataset\\\"\\u007d,\\\"dms\\\":\\u007b\\\"cancelDmCampaign\\\":\\\"cancelACampaignSUnsentMessages: dm\\\",\\\"getDmCampaign\\\":\\\"readOneDmCampaign: dm\\\",\\\"getDmLimits\\\":\\\"dmAllowancesAndUsage: dm\\\",\\\"listDmQueue\\\":\\\"listTheDmQueue: dm\\\",\\\"queueDmCampaign\\\":\\\"queueADmCampaign: dm\\\"\\u007d,\\\"engage\\\":\\u007b\\\"createEngageFeed\\\":\\\"createAnEngageFeed: engage\\\",\\\"deleteEngageFeed\\\":\\\"deleteAnEngageFeed: engage\\\",\\\"draftEngageReply\\\":\\\"draftOneReplyToAPost: engage\\\",\\\"getEngageFeedPosts\\\":\\\"getPostsFromAnEngageFeed: engage\\\",\\\"getMentions\\\":\\\"getMentionsOfTheAccount: engage\\\",\\\"listEngageFeeds\\\":\\\"listEngageFeeds: engage\\\",\\\"updateEngageFeed\\\":\\\"updateAnEngageFeed: engage\\\"\\u007d,\\\"identity\\\":\\u007b\\\"getMe\\\":\\\"getTheKeyOwner: identity\\\",\\\"listAccounts\\\":\\\"listYourAccounts: identity\\\"\\u007d,\\\"inspiration\\\":\\u007b\\\"searchInspiration\\\":\\\"searchTheInspirationLibrary: inspiration\\\",\\\"searchInspirationMedia\\\":\\\"searchTheInspirationMediaIndex: inspiration\\\"\\u007d,\\\"media\\\":\\u007b\\\"createMediaUpload\\\":\\\"presignAnImageUpload: media\\\"\\u007d,\\\"meta\\\":\\u007b\\\"getDocs\\\":\\\"machineReadableQuickstart: meta\\\"\\u007d,\\\"queue\\\":\\u007b\\\"getQueueSettings\\\":\\\"getQueueSettings: queue\\\",\\\"updateQueueSettings\\\":\\\"updateQueueSettings: queue\\\"\\u007d,\\\"scheduling\\\":\\u007b\\\"bulkDeleteScheduledPosts\\\":\\\"deleteQueuedPostsInBulk: scheduling\\\",\\\"bulkEnableAutoRetweet\\\":\\\"enableAutoRetweetOnQueuedPostsInBulk: scheduling\\\",\\\"bulkRetimeScheduledPosts\\\":\\\"retimeQueuedPostsInBulk: scheduling\\\",\\\"createScheduledPost\\\":\\\"createADraftOrScheduledPostOrPublishNow: scheduling\\\",\\\"deleteScheduledPost\\\":\\\"deleteADraftOrScheduledPost: scheduling\\\",\\\"draftPost\\\":\\\"writePostDraftsInYourVoice: scheduling\\\",\\\"listPlugTemplates\\\":\\\"listPlugTemplates: scheduling\\\",\\\"listScheduledPosts\\\":\\\"listDraftsAndScheduledPosts: scheduling\\\",\\\"remixPost\\\":\\\"rewriteAPostInYourVoice: scheduling\\\",\\\"updateScheduledPost\\\":\\\"editADraftOrScheduledPost: scheduling\\\"\\u007d,\\\"signals\\\":\\u007b\\\"addSignalAgentSignal\\\":\\\"addASignalToAnAgent: signal\\\",\\\"createSignalAgent\\\":\\\"createASignalAgent: signal\\\",\\\"deleteSignalAgent\\\":\\\"deleteASignalAgent: signal\\\",\\\"expandIcp\\\":\\\"expandAnAudienceDescriptionIntoARubric: signal\\\",\\\"expandIcpFromUrl\\\":\\\"buildAnAudienceProfileFromAWebsite: signal\\\",\\\"listSignalAgents\\\":\\\"listSignalAgents: signal\\\",\\\"listSignalLeads\\\":\\\"listSignalLeads: signal\\\",\\\"removeSignalAgentSignal\\\":\\\"removeASignalFromAnAgent: signal\\\",\\\"searchLeads\\\":\\\"searchForLeadsOnXNow: signal\\\",\\\"setSignalLeadFeedback\\\":\\\"setFeedbackOnALead: signal\\\",\\\"suggestKeywords\\\":\\\"suggestKeywordWatches: signal\\\",\\\"updateSignalAgent\\\":\\\"updateASignalAgent: signal\\\"\\u007d,\\\"tags\\\":\\u007b\\\"createTag\\\":\\\"createATag: tag\\\",\\\"deleteTag\\\":\\\"deleteATag: tag\\\",\\\"listTags\\\":\\\"listTags: tag\\\",\\\"updateTag\\\":\\\"renameOrRecolorATag: tag\\\"\\u007d,\\\"tools\\\":\\u007b\\\"factCheckText\\\":\\\"checkAStatementAgainstAWebSearch: tool\\\",\\\"inlineEditText\\\":\\\"editOneSelectedPieceOfAPost: tool\\\",\\\"postTriage\\\":\\\"sortRecentPostsOnTopicReadPassOrNotSure: tool\\\",\\\"postViralScore\\\":\\\"scoreADraftAgainstThisAccountSOwnPosts: tool\\\",\\\"rephraseText\\\":\\\"rewriteAPostOnePresetWay: tool\\\"\\u007d,\\\"workers\\\":\\u007b\\\"dismissWorkerSuggestion\\\":\\\"dismissASuggestion: worker\\\",\\\"draftWorkerSuggestion\\\":\\\"saveASuggestionAsADraft: worker\\\",\\\"listWorkerSuggestions\\\":\\\"listWorkerSuggestions: worker\\\",\\\"listWorkers\\\":\\\"listWorkers: worker\\\",\\\"scheduleWorkerSuggestion\\\":\\\"scheduleASuggestion: worker\\\"\\u007d,\\\"xLookups\\\":\\u007b\\\"getXPostReplies\\\":\\\"topRepliesToAPublicPost: xLookup\\\",\\\"getXUserPosts\\\":\\\"latestPostsOfAPublicAccount: xLookup\\\",\\\"lookupXPost\\\":\\\"lookUpOnePublicPostLive: xLookup\\\",\\\"lookupXUser\\\":\\\"lookUpOnePublicProfileLive: xLookup\\\"\\u007d\\u007d\"))[$parameter[\"resource\"]] || {})[$parameter[\"operation\"]] || ($parameter[\"operation\"] + \": \" + $parameter[\"resource\"])}}",
            description: "SuperX helps creators grow on X with post scheduling, analytics, audience insights, and content tools",
            documentationUrl: "https://docs.superx.so/",
            hints: [
                {
                    message: "Operation \"listArticles\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"getAudience\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"listContactListMembers\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"listContacts\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"listContactReplies\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"listDatasets\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"getDatasetRows\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"listDmQueue\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"getEngageFeedPosts\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"getMentions\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"searchInspiration\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"listPosts\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"listReplies\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"listReceivedReplies\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"listScheduledPosts\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"listSignalLeads\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"listWorkerSuggestions\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                }
            ],
            defaults: {
                name: "SuperX"
            },
            usableAsTool: true,
            inputs: [
                n8n_workflow_1.NodeConnectionTypes.Main
            ],
            outputs: [
                n8n_workflow_1.NodeConnectionTypes.Main
            ],
            credentials: [
                {
                    name: "superxApi",
                    required: true
                }
            ],
            properties: [
                {
                    displayName: "Resource",
                    name: "resource",
                    type: "options",
                    noDataExpression: true,
                    default: "analytics",
                    options: [
                        {
                            name: "Analytic",
                            value: "analytics"
                        },
                        {
                            name: "Article",
                            value: "articles"
                        },
                        {
                            name: "Audience",
                            value: "audience"
                        },
                        {
                            name: "Contact List",
                            value: "contactLists"
                        },
                        {
                            name: "Content",
                            value: "content"
                        },
                        {
                            name: "Context",
                            value: "context"
                        },
                        {
                            name: "Dataset",
                            value: "datasets"
                        },
                        {
                            name: "DM",
                            value: "dms"
                        },
                        {
                            name: "Engage",
                            value: "engage"
                        },
                        {
                            name: "Identity",
                            value: "identity"
                        },
                        {
                            name: "Inspiration",
                            value: "inspiration"
                        },
                        {
                            name: "Media",
                            value: "media"
                        },
                        {
                            name: "Meta",
                            value: "meta"
                        },
                        {
                            name: "Queue",
                            value: "queue"
                        },
                        {
                            name: "Scheduling",
                            value: "scheduling"
                        },
                        {
                            name: "Signal",
                            value: "signals"
                        },
                        {
                            name: "Tag",
                            value: "tags"
                        },
                        {
                            name: "Tool",
                            value: "tools"
                        },
                        {
                            name: "Worker",
                            value: "workers"
                        },
                        {
                            name: "X Lookup",
                            value: "xLookups"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "analytics"
                            ]
                        }
                    },
                    default: "getPostAnalytics",
                    options: [
                        {
                            name: "Get",
                            value: "getPostAnalytics",
                            action: "Get analytics",
                            description: "Totals and a per-day series (posts, engagement, impressions, follower. analytics."
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "analytics"
                            ],
                            operation: [
                                "getPostAnalytics"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        },
                        {
                            displayName: "Since",
                            name: "since",
                            type: "dateTime",
                            default: "",
                            description: "UTC ISO-8601 lower bound (explicit z or offset required)"
                        },
                        {
                            displayName: "Until",
                            name: "until",
                            type: "dateTime",
                            default: "",
                            description: "UTC ISO-8601 upper bound (explicit z or offset required)"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "articles"
                            ]
                        }
                    },
                    default: "createArticle",
                    options: [
                        {
                            name: "Create An Article Draft",
                            value: "createArticle",
                            action: "Create article draft",
                            description: "Creates a draft from `content_markdown` (max 400 kb). supports headings, lists, quotes, emphasis, links, HTTP(s) images, and standalone x post embeds. unsupported constructs become plain text with `warnings`; non-HTTP(s) image/link URLs return 400. articles."
                        },
                        {
                            name: "Delete An",
                            value: "deleteArticle",
                            action: "Delete article",
                            description: "Deletes the article and refunds quota if it was scheduled. works for the main and linked accounts; shared accounts are read-only."
                        },
                        {
                            name: "Edit An",
                            value: "updateArticle",
                            action: "Edit article",
                            description: "Updates supplied fields only. `content_markdown` replaces the full body; `cover_url` accepts an HTTP(s) image URL or `null` to remove it. main and linked accounts are writable; shared accounts are read-only. articles."
                        },
                        {
                            name: "Generate An AI Cover Image",
                            value: "generateArticleCover",
                            action: "Generate ai cover image articles",
                            description: "Generates a 2.5:1 cover from the required title and attaches it by default. `attach: false` leaves the cover unchanged. choose `style_id` or `style_text` (max 8,000 characters), not both; unknown IDs return `404 cover_style_not_found`. articles."
                        },
                        {
                            name: "Get An",
                            value: "getArticle",
                            action: "Get article",
                            description: "Returns the article and `content_markdown`; rich-text constructs that markdown cannot express may appear as plain text"
                        },
                        {
                            name: "List",
                            value: "listArticles",
                            action: "List articles",
                            description: "Long-form x articles for the selected account, newest-updated first. article bodies do not appear in lists; fetch one article for its markdown body."
                        },
                        {
                            name: "List Saved Cover Styles",
                            value: "listCoverStyles",
                            action: "List saved cover styles articles",
                            description: "The article cover styles the account saved in the superx app: the art"
                        },
                        {
                            name: "Publish An Article To X Now",
                            value: "publishArticle",
                            action: "Publish article to x now",
                            description: "Publishes the stored title, body, and cover publicly and immediately, spending post quota. requires x premium; x's limits of 10 drafts and 5 publishes per day can return `502 x_publish_failed`. articles."
                        },
                        {
                            name: "Schedule Or Reschedule An",
                            value: "scheduleArticle",
                            action: "Schedule or reschedule an article",
                            description: "Schedules `scheduled_for` in UTC ISO 8601 with an explicit offset, over 2 minutes ahead. draft scheduling deducts quota (refunded on unschedule/delete); rescheduling is free. supports `idempotency-key`; shared accounts are read-only. articles."
                        },
                        {
                            name: "Unschedule An",
                            value: "unscheduleArticle",
                            action: "Unschedule article",
                            description: "Moves a scheduled article back to draft and refunds its scheduling quota. works for the main and linked accounts; shared accounts are read-only."
                        }
                    ]
                },
                {
                    displayName: "Title",
                    name: "title",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "articles"
                            ],
                            operation: [
                                "createArticle"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "articles"
                            ],
                            operation: [
                                "createArticle"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Any account you own, meaning your main account (the default when omitted) or one linked to it. an account shared with you returns `403 writes_main_account_only`."
                        },
                        {
                            displayName: "Content Markdown",
                            name: "content_markdown",
                            type: "string",
                            default: "",
                            description: "Article body as markdown. omit for an empty draft."
                        },
                        {
                            displayName: "Idempotency Key",
                            name: "Idempotency-Key",
                            type: "string",
                            default: "",
                            description: "Unique key (max 64 characters) for safe retries. replays carry the \"idempotency-replayed\" response header set to \"true\". keys are retained for 24 hours."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the article to delete",
                    displayOptions: {
                        show: {
                            resource: [
                                "articles"
                            ],
                            operation: [
                                "deleteArticle"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "articles"
                            ],
                            operation: [
                                "deleteArticle"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the article whose cover image to generate",
                    displayOptions: {
                        show: {
                            resource: [
                                "articles"
                            ],
                            operation: [
                                "generateArticleCover"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "articles"
                            ],
                            operation: [
                                "generateArticleCover"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Attach",
                            name: "attach",
                            type: "boolean",
                            default: true,
                            description: "Whether to enable attach"
                        },
                        {
                            displayName: "Idempotency Key",
                            name: "Idempotency-Key",
                            type: "string",
                            default: "",
                            description: "Unique key (max 64 characters) for safe retries. replays carry the \"idempotency-replayed\" response header set to \"true\". keys are retained for 24 hours."
                        },
                        {
                            displayName: "Style ID",
                            name: "style_id",
                            type: "string",
                            default: "",
                            description: "A saved cover style ID from `get /v1/cover-styles`. not accepted together with style_text."
                        },
                        {
                            displayName: "Style Text",
                            name: "style_text",
                            type: "string",
                            default: "",
                            description: "Optional one-off style description steering the artwork. not accepted together with style_id."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the article to retrieve",
                    displayOptions: {
                        show: {
                            resource: [
                                "articles"
                            ],
                            operation: [
                                "getArticle"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "articles"
                            ],
                            operation: [
                                "getArticle"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "articles"
                            ],
                            operation: [
                                "listArticles"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 1,
                            description: "1-based page number",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Status",
                            name: "status",
                            type: "string",
                            default: "",
                            description: "Comma list of statuses to include: draft, scheduled, publishing, published, failed. omit for all.",
                            placeholder: "e.g. draft,scheduled"
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "articles"
                            ],
                            operation: [
                                "listCoverStyles"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the article to publish",
                    displayOptions: {
                        show: {
                            resource: [
                                "articles"
                            ],
                            operation: [
                                "publishArticle"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "articles"
                            ],
                            operation: [
                                "publishArticle"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Idempotency Key",
                            name: "Idempotency-Key",
                            type: "string",
                            default: "",
                            description: "Unique key (max 64 characters) for safe retries. replays carry the \"idempotency-replayed\" response header set to \"true\". keys are retained for 24 hours."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the article to schedule",
                    displayOptions: {
                        show: {
                            resource: [
                                "articles"
                            ],
                            operation: [
                                "scheduleArticle"
                            ]
                        }
                    }
                },
                {
                    displayName: "Scheduled For",
                    name: "scheduled_for",
                    type: "dateTime",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "articles"
                            ],
                            operation: [
                                "scheduleArticle"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "articles"
                            ],
                            operation: [
                                "scheduleArticle"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Idempotency Key",
                            name: "Idempotency-Key",
                            type: "string",
                            default: "",
                            description: "Unique key (max 64 characters) for safe retries. replays carry the \"idempotency-replayed\" response header set to \"true\". keys are retained for 24 hours."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the article to unschedule",
                    displayOptions: {
                        show: {
                            resource: [
                                "articles"
                            ],
                            operation: [
                                "unscheduleArticle"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "articles"
                            ],
                            operation: [
                                "unscheduleArticle"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: ""
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the article to update",
                    displayOptions: {
                        show: {
                            resource: [
                                "articles"
                            ],
                            operation: [
                                "updateArticle"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "articles"
                            ],
                            operation: [
                                "updateArticle"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Content Markdown",
                            name: "content_markdown",
                            type: "string",
                            default: "",
                            description: "Full replacement body as markdown (max 400kb)"
                        },
                        {
                            displayName: "Cover URL",
                            name: "cover_url",
                            type: "string",
                            default: "",
                            description: "HTTP(s) image URL to set as the cover, or null to remove it"
                        },
                        {
                            displayName: "Title",
                            name: "title",
                            type: "string",
                            default: ""
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "audience"
                            ]
                        }
                    },
                    default: "createContactNote",
                    options: [
                        {
                            name: "Add A Note To A Contact",
                            value: "createContactNote",
                            action: "Add note to a contact audience",
                            description: "Write a private note about one person. the note is attributed to the. audience."
                        },
                        {
                            name: "Delete A Note On A Contact",
                            value: "deleteContactNote",
                            action: "Delete note on a contact audience",
                            description: "Returns 204 with no body. deleting an already-deleted note, or a note. audience."
                        },
                        {
                            name: "Edit A Note On A Contact",
                            value: "updateContactNote",
                            action: "Edit note on a contact audience",
                            description: "Replace one note's body. the note must belong to the contact in the. audience."
                        },
                        {
                            name: "Get One Contact",
                            value: "getContact",
                            action: "Get one contact audience",
                            description: "One person's stored profile (handle, name, bio, location, website,. audience."
                        },
                        {
                            name: "List Engaged Contacts",
                            value: "listContacts",
                            action: "List engaged contacts audience",
                            description: "People who engaged with the selected account over the moving 90-day window, with reply and repost tallies. audience."
                        },
                        {
                            name: "List Notes On A Contact",
                            value: "listContactNotes",
                            action: "List notes on a contact audience",
                            description: "The private notes this account has written about one person, newest. audience."
                        },
                        {
                            name: "List One Contact'S Replies To You",
                            value: "listContactReplies",
                            action: "List one contact s replies to you audience",
                            description: "The stored reply history from one contact to the selected account, with the replied-to post when available. audience."
                        },
                        {
                            name: "List Replies You Received",
                            value: "listReceivedReplies",
                            action: "List replies you received audience",
                            description: "Every stored reply the selected account has received across all of its posts, with the replier's profile and the replied-to post when available. audience."
                        },
                        {
                            name: "Read An Audience List",
                            value: "getAudience",
                            action: "Read audience list",
                            description: "A page of the account's followers, following, repliers or reposters. audience."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The person's numeric x user ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "audience"
                            ],
                            operation: [
                                "createContactNote"
                            ]
                        }
                    }
                },
                {
                    displayName: "Body",
                    name: "body",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "audience"
                            ],
                            operation: [
                                "createContactNote"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "audience"
                            ],
                            operation: [
                                "createContactNote"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "The account to write as. defaults to your main account."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The person's numeric x user ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "audience"
                            ],
                            operation: [
                                "deleteContactNote"
                            ]
                        }
                    }
                },
                {
                    displayName: "Note ID",
                    name: "noteId",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The note ID from `get /v1/contacts/{ID}/notes`",
                    displayOptions: {
                        show: {
                            resource: [
                                "audience"
                            ],
                            operation: [
                                "deleteContactNote"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "audience"
                            ],
                            operation: [
                                "deleteContactNote"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        }
                    ]
                },
                {
                    displayName: "Kind",
                    name: "kind",
                    type: "options",
                    default: "followers",
                    required: true,
                    description: "Audience list to read: followers, following, repliers, or reposters",
                    options: [
                        {
                            name: "Followers",
                            value: "followers"
                        },
                        {
                            name: "Following",
                            value: "following"
                        },
                        {
                            name: "Repliers",
                            value: "repliers"
                        },
                        {
                            name: "Reposters",
                            value: "reposters"
                        }
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "audience"
                            ],
                            operation: [
                                "getAudience"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "audience"
                            ],
                            operation: [
                                "getAudience"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        },
                        {
                            displayName: "Cursor",
                            name: "cursor",
                            type: "string",
                            default: "",
                            description: "Next_cursor from the previous page. omit for the first page."
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The person's numeric x user ID (from `get /v1/contacts`, list members, or signal leads)",
                    displayOptions: {
                        show: {
                            resource: [
                                "audience"
                            ],
                            operation: [
                                "getContact"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "audience"
                            ],
                            operation: [
                                "getContact"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        },
                        {
                            displayName: "Refresh",
                            name: "refresh",
                            type: "boolean",
                            default: false,
                            description: "Whether refresh the profile from x when the stored copy is stale. costs one enrichment unit. the `refresh=true` enrichment unit is charged only after the contact gate passes, so an ID outside your contacts does not spend one."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The person's numeric x user ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "audience"
                            ],
                            operation: [
                                "listContactNotes"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "audience"
                            ],
                            operation: [
                                "listContactNotes"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The contact's ID from `get /v1/contacts`",
                    displayOptions: {
                        show: {
                            resource: [
                                "audience"
                            ],
                            operation: [
                                "listContactReplies"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "audience"
                            ],
                            operation: [
                                "listContactReplies"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 1,
                            description: "1-based page number",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Sort",
                            name: "sort",
                            type: "options",
                            default: "recent",
                            description: "Choose whether to sort this contact\u2019s replies by recency or likes",
                            options: [
                                {
                                    name: "Most Liked",
                                    value: "most_liked"
                                },
                                {
                                    name: "Recent",
                                    value: "recent"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "audience"
                            ],
                            operation: [
                                "listContacts"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 1,
                            description: "1-based page number",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Sort",
                            name: "sort",
                            type: "options",
                            default: "engagement",
                            description: "Choose whether to order contacts by engagement, replies, or reposts",
                            options: [
                                {
                                    name: "Engagement",
                                    value: "engagement"
                                },
                                {
                                    name: "Replies",
                                    value: "replies"
                                },
                                {
                                    name: "Reposts",
                                    value: "reposts"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "audience"
                            ],
                            operation: [
                                "listReceivedReplies"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 1,
                            description: "1-based page number",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Since",
                            name: "since",
                            type: "dateTime",
                            default: "",
                            description: "UTC ISO-8601 lower bound (explicit z or offset required)"
                        },
                        {
                            displayName: "Sort",
                            name: "sort",
                            type: "options",
                            default: "recent",
                            description: "Choose whether to sort received replies by recency or likes",
                            options: [
                                {
                                    name: "Most Liked",
                                    value: "most_liked"
                                },
                                {
                                    name: "Recent",
                                    value: "recent"
                                }
                            ]
                        },
                        {
                            displayName: "Until",
                            name: "until",
                            type: "dateTime",
                            default: "",
                            description: "UTC ISO-8601 upper bound (explicit z or offset required)"
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The person's numeric x user ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "audience"
                            ],
                            operation: [
                                "updateContactNote"
                            ]
                        }
                    }
                },
                {
                    displayName: "Note ID",
                    name: "noteId",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The note ID from `get /v1/contacts/{ID}/notes`",
                    displayOptions: {
                        show: {
                            resource: [
                                "audience"
                            ],
                            operation: [
                                "updateContactNote"
                            ]
                        }
                    }
                },
                {
                    displayName: "Body",
                    name: "body",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "audience"
                            ],
                            operation: [
                                "updateContactNote"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "audience"
                            ],
                            operation: [
                                "updateContactNote"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: ""
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "contactLists"
                            ]
                        }
                    },
                    default: "addContactListMember",
                    options: [
                        {
                            name: "Add A Contact List Member",
                            value: "addContactListMember",
                            action: "Add contact list member",
                            description: "Add a person to a list you created, by `handle` (live profile lookup). contact lists."
                        },
                        {
                            name: "Add Contact List Members In Bulk",
                            value: "addContactListMembers",
                            action: "Add contact list members in bulk",
                            description: "Add up to 500 people to a list you created, by numeric x user ID. contact lists."
                        },
                        {
                            name: "Create A",
                            value: "createContactList",
                            action: "Create contact list",
                            description: "Create a list you can add people to. names are not unique: the superx. contact lists."
                        },
                        {
                            name: "Delete A",
                            value: "deleteContactList",
                            action: "Delete contact list",
                            description: "Delete a list you created, and with it its membership. the people. contact lists."
                        },
                        {
                            name: "List",
                            value: "listContactLists",
                            action: "List contact lists",
                            description: "The selected account's contact lists: system lists first (followers,"
                        },
                        {
                            name: "List Contact List Members",
                            value: "listContactListMembers",
                            action: "List contact list members",
                            description: "Members of one contact list you created. includes a 90-day."
                        },
                        {
                            name: "Remove A Contact List Member",
                            value: "removeContactListMember",
                            action: "Remove contact list member",
                            description: "Remove a member from a list you created. returns 204 with no body. contact lists."
                        },
                        {
                            name: "Remove Contact List Members In Bulk",
                            value: "removeContactListMembers",
                            action: "Remove contact list members in bulk",
                            description: "Remove up to 500 members from a list you created, by member ID (the. contact lists."
                        },
                        {
                            name: "Rename A",
                            value: "renameContactList",
                            action: "Rename contact list",
                            description: "Rename a list you created. system lists are managed automatically and. contact lists."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The list ID from `get /v1/contact-lists`",
                    displayOptions: {
                        show: {
                            resource: [
                                "contactLists"
                            ],
                            operation: [
                                "addContactListMember"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "contactLists"
                            ],
                            operation: [
                                "addContactListMember"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        },
                        {
                            displayName: "Handle",
                            name: "handle",
                            type: "string",
                            default: "",
                            description: "X username, with or without the @"
                        },
                        {
                            displayName: "X User ID",
                            name: "x_user_id",
                            type: "string",
                            default: "",
                            description: "Numeric x user ID"
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The list ID from `get /v1/contact-lists`",
                    displayOptions: {
                        show: {
                            resource: [
                                "contactLists"
                            ],
                            operation: [
                                "addContactListMembers"
                            ]
                        }
                    }
                },
                {
                    displayName: "X User IDs",
                    name: "x_user_ids",
                    type: "json",
                    default: [],
                    required: true,
                    description: "Numeric x user IDs",
                    displayOptions: {
                        show: {
                            resource: [
                                "contactLists"
                            ],
                            operation: [
                                "addContactListMembers"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "contactLists"
                            ],
                            operation: [
                                "addContactListMembers"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: ""
                        }
                    ]
                },
                {
                    displayName: "Name",
                    name: "name",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "contactLists"
                            ],
                            operation: [
                                "createContactList"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "contactLists"
                            ],
                            operation: [
                                "createContactList"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: ""
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The list ID from `get /v1/contact-lists`",
                    displayOptions: {
                        show: {
                            resource: [
                                "contactLists"
                            ],
                            operation: [
                                "deleteContactList"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "contactLists"
                            ],
                            operation: [
                                "deleteContactList"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The list ID from `get /v1/contact-lists`",
                    displayOptions: {
                        show: {
                            resource: [
                                "contactLists"
                            ],
                            operation: [
                                "listContactListMembers"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "contactLists"
                            ],
                            operation: [
                                "listContactListMembers"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 1,
                            description: "1-based page number",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Q",
                            name: "q",
                            type: "string",
                            default: "",
                            description: "Filter members by handle or name substring"
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "contactLists"
                            ],
                            operation: [
                                "listContactLists"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The list ID from `get /v1/contact-lists`",
                    displayOptions: {
                        show: {
                            resource: [
                                "contactLists"
                            ],
                            operation: [
                                "removeContactListMember"
                            ]
                        }
                    }
                },
                {
                    displayName: "Member ID",
                    name: "memberId",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The member ID from `get /v1/contact-lists/{ID}/members`",
                    displayOptions: {
                        show: {
                            resource: [
                                "contactLists"
                            ],
                            operation: [
                                "removeContactListMember"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "contactLists"
                            ],
                            operation: [
                                "removeContactListMember"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The list ID from `get /v1/contact-lists`",
                    displayOptions: {
                        show: {
                            resource: [
                                "contactLists"
                            ],
                            operation: [
                                "removeContactListMembers"
                            ]
                        }
                    }
                },
                {
                    displayName: "Member IDs",
                    name: "member_ids",
                    type: "json",
                    default: [],
                    required: true,
                    description: "Member IDs from `get /v1/contact-lists/{ID}/members`",
                    displayOptions: {
                        show: {
                            resource: [
                                "contactLists"
                            ],
                            operation: [
                                "removeContactListMembers"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "contactLists"
                            ],
                            operation: [
                                "removeContactListMembers"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: ""
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The list ID from `get /v1/contact-lists`",
                    displayOptions: {
                        show: {
                            resource: [
                                "contactLists"
                            ],
                            operation: [
                                "renameContactList"
                            ]
                        }
                    }
                },
                {
                    displayName: "Name",
                    name: "name",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "contactLists"
                            ],
                            operation: [
                                "renameContactList"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "contactLists"
                            ],
                            operation: [
                                "renameContactList"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: ""
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "content"
                            ]
                        }
                    },
                    default: "listPosts",
                    options: [
                        {
                            name: "List Published Posts",
                            value: "listPosts",
                            action: "List published posts content",
                            description: "Lists posts written by the account, with optional content type, date range, and sort filters"
                        },
                        {
                            name: "List Replies You Sent",
                            value: "listReplies",
                            action: "List replies you sent content",
                            description: "Replies the selected account sent to other accounts, newest first. a. content."
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "content"
                            ],
                            operation: [
                                "listPosts"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 1,
                            description: "1-based page number",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Since",
                            name: "since",
                            type: "dateTime",
                            default: "",
                            description: "UTC ISO-8601 lower bound (explicit z or offset required)"
                        },
                        {
                            displayName: "Sort",
                            name: "sort",
                            type: "options",
                            default: "posted_at",
                            description: "Choose whether to sort posts by publication time, likes, or impressions",
                            options: [
                                {
                                    name: "Impressions",
                                    value: "impressions"
                                },
                                {
                                    name: "Likes",
                                    value: "likes"
                                },
                                {
                                    name: "Posted At",
                                    value: "posted_at"
                                }
                            ]
                        },
                        {
                            displayName: "Type",
                            name: "type",
                            type: "options",
                            default: "posts",
                            description: "`Posts` returns original posts, quote posts, and thread continuations, excluding replies to others and reposts. `replies` returns replies to others. `all` returns all authored posts and reposts.",
                            options: [
                                {
                                    name: "All",
                                    value: "all"
                                },
                                {
                                    name: "Posts",
                                    value: "posts"
                                },
                                {
                                    name: "Replies",
                                    value: "replies"
                                }
                            ]
                        },
                        {
                            displayName: "Until",
                            name: "until",
                            type: "dateTime",
                            default: "",
                            description: "UTC ISO-8601 upper bound (explicit z or offset required)"
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "content"
                            ],
                            operation: [
                                "listReplies"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 1,
                            description: "1-based page number",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Since",
                            name: "since",
                            type: "dateTime",
                            default: "",
                            description: "UTC ISO-8601 lower bound (explicit z or offset required)"
                        },
                        {
                            displayName: "Until",
                            name: "until",
                            type: "dateTime",
                            default: "",
                            description: "UTC ISO-8601 upper bound (explicit z or offset required)"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "context"
                            ]
                        }
                    },
                    default: "deleteContextProduct",
                    options: [
                        {
                            name: "Add Or Edit One Product",
                            value: "updateContextProduct",
                            action: "Add or edit one product context",
                            description: "Updates one product by numeric ID or URL-encoded URL. URL-based requests create the product if absent (max 5). omitted fields stay unchanged; send `null` to clear a field. context."
                        },
                        {
                            name: "Get Context Settings",
                            value: "getContext",
                            action: "Get context settings",
                            description: "Returns the account's ai context: profile description, interests, rules, reply guidance, favorite creators, style guide, and up to five products"
                        },
                        {
                            name: "Rebuild The Generated Style Guide",
                            value: "regenerateStyleGuide",
                            action: "Rebuild generated style guide context",
                            description: "Rewrites the account's generated style guide from its recent posts,. context."
                        },
                        {
                            name: "Refresh A Product From Its Page",
                            value: "scrapeContextProduct",
                            action: "Refresh product from its page context",
                            description: "Re-reads a saved product's page and refreshes its stored name,. context."
                        },
                        {
                            name: "Remove One Product",
                            value: "deleteContextProduct",
                            action: "Remove one product context",
                            description: "Removes one product by its numeric ID (from get /v1/context). reversible: re-adding the same URL via patch or put restores the product with its scraped details intact."
                        },
                        {
                            name: "Replace The Product List",
                            value: "setContextProducts",
                            action: "Replace product list context",
                            description: "Replaces the full product list (max 5); products omitted by URL are removed. use patch `/v1/context/products/{ID}` to update one product. re-adding a URL restores its scraped details; omitted fields stay unchanged and `null` clears them."
                        },
                        {
                            name: "Update Context Settings",
                            value: "updateContext",
                            action: "Update context settings",
                            description: "Updates selected context fields; omitted fields stay unchanged. `null` clears strings; arrays replace the full list (`[]` clears it). only owners can change context; editor-access shares return `403 editor_restricted`."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Numeric product ID",
                    displayOptions: {
                        show: {
                            resource: [
                                "context"
                            ],
                            operation: [
                                "deleteContextProduct"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "context"
                            ],
                            operation: [
                                "deleteContextProduct"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "context"
                            ],
                            operation: [
                                "getContext"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "context"
                            ],
                            operation: [
                                "regenerateStyleGuide"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        },
                        {
                            displayName: "Account ID (Body)",
                            name: "account_idBody",
                            type: "string",
                            default: ""
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Numeric product ID, from get /v1/context",
                    displayOptions: {
                        show: {
                            resource: [
                                "context"
                            ],
                            operation: [
                                "scrapeContextProduct"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "context"
                            ],
                            operation: [
                                "scrapeContextProduct"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        },
                        {
                            displayName: "Account ID (Body)",
                            name: "account_idBody",
                            type: "string",
                            default: ""
                        }
                    ]
                },
                {
                    displayName: "Products",
                    name: "products",
                    type: "json",
                    default: [],
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "context"
                            ],
                            operation: [
                                "setContextProducts"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "context"
                            ],
                            operation: [
                                "setContextProducts"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        },
                        {
                            displayName: "Account ID (Body)",
                            name: "account_idBody",
                            type: "string",
                            default: ""
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "context"
                            ],
                            operation: [
                                "updateContext"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        },
                        {
                            displayName: "Account ID (Body)",
                            name: "account_idBody",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Interests",
                            name: "interests",
                            type: "json",
                            default: []
                        },
                        {
                            displayName: "Profile Description",
                            name: "profile_description",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Enabled",
                                    name: "enabled",
                                    type: "boolean",
                                    default: false,
                                    description: "Whether to enable enabled"
                                },
                                {
                                    displayName: "Text",
                                    name: "text",
                                    type: "string",
                                    default: ""
                                }
                            ]
                        },
                        {
                            displayName: "Reply",
                            name: "reply",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Custom Instructions",
                                    name: "custom_instructions",
                                    type: "string",
                                    default: ""
                                },
                                {
                                    displayName: "Include Author Name",
                                    name: "include_author_name",
                                    type: "boolean",
                                    default: false,
                                    description: "Whether to enable include author name"
                                }
                            ]
                        },
                        {
                            displayName: "Rules",
                            name: "rules",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Style Guide",
                            name: "style_guide",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Audience Override",
                                    name: "audience_override",
                                    type: "string",
                                    default: ""
                                },
                                {
                                    displayName: "Vocabulary Override",
                                    name: "vocabulary_override",
                                    type: "string",
                                    default: ""
                                }
                            ]
                        },
                        {
                            displayName: "Voice",
                            name: "voice",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Favorite Creators",
                                    name: "favorite_creators",
                                    type: "json",
                                    default: []
                                },
                                {
                                    displayName: "Use Own Posts As Examples",
                                    name: "use_own_posts_as_examples",
                                    type: "boolean",
                                    default: false,
                                    description: "Whether to enable use own posts as examples"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Numeric product ID, or a URL-encoded HTTP(s) product URL",
                    displayOptions: {
                        show: {
                            resource: [
                                "context"
                            ],
                            operation: [
                                "updateContextProduct"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "context"
                            ],
                            operation: [
                                "updateContextProduct"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        },
                        {
                            displayName: "Account ID (Body)",
                            name: "account_idBody",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Description",
                            name: "description",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Features",
                            name: "features",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Name",
                            name: "name",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Positioning",
                            name: "positioning",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Updates",
                            name: "updates",
                            type: "string",
                            default: ""
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "datasets"
                            ]
                        }
                    },
                    default: "addDatasetToContacts",
                    options: [
                        {
                            name: "Add A Dataset'S People To A Contact List",
                            value: "addDatasetToContacts",
                            action: "Add dataset s people to a contact list",
                            description: "Copy the people in a ready dataset into a contact list you created"
                        },
                        {
                            name: "Collect An Audience Into A",
                            value: "createDataset",
                            action: "Collect audience into a dataset",
                            description: "Collect the repliers, quote posters or reposters of a post, the. datasets."
                        },
                        {
                            name: "Draft Outreach Messages Onto A Research",
                            value: "draftDatasetOutreach",
                            action: "Draft outreach messages onto a research dataset",
                            description: "Writes one personalized message per person in a research dataset,"
                        },
                        {
                            name: "Export A Dataset As CSV",
                            value: "exportDataset",
                            action: "Export dataset as CSV",
                            description: "The whole dataset as a CSV file"
                        },
                        {
                            name: "Get A",
                            value: "getDataset",
                            action: "Get dataset",
                            description: "One dataset's status, counts and coverage"
                        },
                        {
                            name: "Get Dataset Rows",
                            value: "getDatasetRows",
                            action: "Get dataset rows",
                            description: "A page of a ready dataset's rows"
                        },
                        {
                            name: "List",
                            value: "listDatasets",
                            action: "List datasets",
                            description: "The audience collections ask superx built for the key owner in the. datasets."
                        },
                        {
                            name: "Refine A Dataset By What Each Person Wrote",
                            value: "refineDataset",
                            action: "Refine dataset by what each person wrote",
                            description: "Judges each row's own text against a natural-language `criterion` and. datasets."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The dataset ID from `get /v1/datasets`",
                    hint: "Expected format: ^[A-Za-z0-9_-]{1,64}$",
                    displayOptions: {
                        show: {
                            resource: [
                                "datasets"
                            ],
                            operation: [
                                "addDatasetToContacts"
                            ]
                        }
                    }
                },
                {
                    displayName: "List ID",
                    name: "list_id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "A contact list you created, from `get /v1/contact-lists`",
                    displayOptions: {
                        show: {
                            resource: [
                                "datasets"
                            ],
                            operation: [
                                "addDatasetToContacts"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "datasets"
                            ],
                            operation: [
                                "addDatasetToContacts"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: ""
                        }
                    ]
                },
                {
                    displayName: "Source",
                    name: "source",
                    type: "options",
                    default: "repliers",
                    required: true,
                    description: "Post target for `repliers`/`quoters`/`reposters`; public x list for `list_members`; synced posts for `my_posts`/`my_replies`. for `research`, use `focus` and one of `handles`, `list_id`, `agent_id`, or `dataset_id`; it ignores `target`/`filters`.",
                    options: [
                        {
                            name: "List Members",
                            value: "list_members"
                        },
                        {
                            name: "My Posts",
                            value: "my_posts"
                        },
                        {
                            name: "My Replies",
                            value: "my_replies"
                        },
                        {
                            name: "Quoters",
                            value: "quoters"
                        },
                        {
                            name: "Repliers",
                            value: "repliers"
                        },
                        {
                            name: "Reposters",
                            value: "reposters"
                        },
                        {
                            name: "Research",
                            value: "research"
                        }
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "datasets"
                            ],
                            operation: [
                                "createDataset"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "datasets"
                            ],
                            operation: [
                                "createDataset"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Which of your accounts to collect as. omit for the main account."
                        },
                        {
                            displayName: "Agent ID",
                            name: "agent_id",
                            type: "number",
                            default: 0,
                            description: "`Research` only: research this signal agent's leads. exactly one source field.",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Dataset ID",
                            name: "dataset_id",
                            type: "string",
                            default: "",
                            description: "`Research` only: research the people in this dataset. exactly one source field."
                        },
                        {
                            displayName: "Filters",
                            name: "filters",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Bio Keywords",
                                    name: "bio_keywords",
                                    type: "json",
                                    default: [],
                                    description: "Keep only people whose x bio contains one of these. ignored for own content."
                                },
                                {
                                    displayName: "Keywords",
                                    name: "keywords",
                                    type: "json",
                                    default: [],
                                    description: "Keep only rows whose reply, quote or (own content) post text contains one of these. not applied to reposters or list members, whose rows carry no text."
                                },
                                {
                                    displayName: "Min Followers",
                                    name: "min_followers",
                                    type: "number",
                                    default: 0,
                                    description: "Keep only people with at least this many followers. ignored for own content.",
                                    typeOptions: {
                                        minValue: 0
                                    }
                                },
                                {
                                    displayName: "Require Can Dm",
                                    name: "require_can_dm",
                                    type: "boolean",
                                    default: false,
                                    description: "Whether keep only people whose dms look open. ignored for own content."
                                },
                                {
                                    displayName: "Require Website",
                                    name: "require_website",
                                    type: "boolean",
                                    default: false,
                                    description: "Whether keep only people with a website link in their profile. ignored for own content."
                                },
                                {
                                    displayName: "Since Days",
                                    name: "since_days",
                                    type: "number",
                                    default: 0,
                                    description: "Own content only: keep posts from the last n days",
                                    typeOptions: {
                                        minValue: 1
                                    }
                                },
                                {
                                    displayName: "Sort",
                                    name: "sort",
                                    type: "options",
                                    default: "recent",
                                    description: "Own content only: which posts to keep when max_rows cuts the list",
                                    options: [
                                        {
                                            name: "Impressions",
                                            value: "impressions"
                                        },
                                        {
                                            name: "Likes",
                                            value: "likes"
                                        },
                                        {
                                            name: "Recent",
                                            value: "recent"
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            displayName: "Focus",
                            name: "focus",
                            type: "string",
                            default: "",
                            description: "`Research` only: an optional steer, e.g. \"founders who might need audience-growth tooling\""
                        },
                        {
                            displayName: "Handles",
                            name: "handles",
                            type: "json",
                            default: [],
                            description: "`Research` only: research these x handles (with or without the @). exactly one source field."
                        },
                        {
                            displayName: "Idempotency Key",
                            name: "Idempotency-Key",
                            type: "string",
                            default: "",
                            description: "Unique key (max 64 characters) for safe retries. replays carry the \"idempotency-replayed\" response header set to \"true\". keys are retained for 24 hours."
                        },
                        {
                            displayName: "List ID",
                            name: "list_id",
                            type: "string",
                            default: "",
                            description: "`Research` only: research the members of this contact list. exactly one source field."
                        },
                        {
                            displayName: "Max Rows",
                            name: "max_rows",
                            type: "number",
                            default: 500,
                            description: "Rows to collect at most. for `source: \"research\"` the range is 1-25 and the default is 10 (one profile per row).",
                            typeOptions: {
                                minValue: 1,
                                maxValue: 1000
                            }
                        },
                        {
                            displayName: "Target",
                            name: "target",
                            type: "string",
                            default: "",
                            description: "An x.com post URL or numeric post ID, or for list_members an x.com list URL (/i/lists/&lt;ID&gt;) or numeric list ID. omit for my_posts and my_replies."
                        },
                        {
                            displayName: "Title",
                            name: "title",
                            type: "string",
                            default: "",
                            description: "Title for the dataset. a sensible one is generated when omitted."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The dataset ID from `get /v1/datasets`",
                    hint: "Expected format: ^[A-Za-z0-9_-]{1,64}$",
                    displayOptions: {
                        show: {
                            resource: [
                                "datasets"
                            ],
                            operation: [
                                "draftDatasetOutreach"
                            ]
                        }
                    }
                },
                {
                    displayName: "Format",
                    name: "format",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The template or example message every draft should follow. keep `[name]`, `[first]` and `[handle]` tokens if you want them filled in per recipient at send time.",
                    displayOptions: {
                        show: {
                            resource: [
                                "datasets"
                            ],
                            operation: [
                                "draftDatasetOutreach"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "datasets"
                            ],
                            operation: [
                                "draftDatasetOutreach"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Which of your accounts to draft as. omit for the main account."
                        },
                        {
                            displayName: "Instructions",
                            name: "instructions",
                            type: "string",
                            default: "",
                            description: "Optional extra steer: tone, what to emphasize, what to avoid"
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The dataset ID from `get /v1/datasets`",
                    hint: "Expected format: ^[A-Za-z0-9_-]{1,64}$",
                    displayOptions: {
                        show: {
                            resource: [
                                "datasets"
                            ],
                            operation: [
                                "exportDataset"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "datasets"
                            ],
                            operation: [
                                "exportDataset"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Format",
                            name: "format",
                            type: "options",
                            default: "csv",
                            description: "Only `CSV` is supported. any other value returns 400.",
                            options: [
                                {
                                    name: "CSV",
                                    value: "csv"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The dataset ID from `get /v1/datasets`",
                    hint: "Expected format: ^[A-Za-z0-9_-]{1,64}$",
                    displayOptions: {
                        show: {
                            resource: [
                                "datasets"
                            ],
                            operation: [
                                "getDataset"
                            ]
                        }
                    }
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The dataset ID from `get /v1/datasets`",
                    hint: "Expected format: ^[A-Za-z0-9_-]{1,64}$",
                    displayOptions: {
                        show: {
                            resource: [
                                "datasets"
                            ],
                            operation: [
                                "getDatasetRows"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "datasets"
                            ],
                            operation: [
                                "getDatasetRows"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 1,
                            description: "1-based page number",
                            typeOptions: {
                                minValue: 1
                            }
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "datasets"
                            ],
                            operation: [
                                "listDatasets"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 1,
                            description: "1-based page number",
                            typeOptions: {
                                minValue: 1
                            }
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The dataset ID from `get /v1/datasets`",
                    hint: "Expected format: ^[A-Za-z0-9_-]{1,64}$",
                    displayOptions: {
                        show: {
                            resource: [
                                "datasets"
                            ],
                            operation: [
                                "refineDataset"
                            ]
                        }
                    }
                },
                {
                    displayName: "Criterion",
                    name: "criterion",
                    type: "string",
                    default: "",
                    required: true,
                    description: "What the rows to match look like, judged on each row's own text, e.g. \"supportive or neutral; not mean, sarcastic, or hostile\"",
                    displayOptions: {
                        show: {
                            resource: [
                                "datasets"
                            ],
                            operation: [
                                "refineDataset"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "datasets"
                            ],
                            operation: [
                                "refineDataset"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Which of your accounts to refine as. omit for the main account."
                        },
                        {
                            displayName: "Keep Matching",
                            name: "keep_matching",
                            type: "boolean",
                            default: true,
                            description: "Whether true keeps the rows that match the criterion; false keeps the rows that do not"
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Sort By",
                            name: "sort_by",
                            type: "options",
                            default: "none",
                            description: "Sort the kept rows descending before the limit is applied",
                            options: [
                                {
                                    name: "Followers",
                                    value: "followers"
                                },
                                {
                                    name: "Likes",
                                    value: "likes"
                                },
                                {
                                    name: "None",
                                    value: "none"
                                }
                            ]
                        },
                        {
                            displayName: "Title",
                            name: "title",
                            type: "string",
                            default: "",
                            description: "Title for the new dataset. a sensible one is generated when omitted."
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "dms"
                            ]
                        }
                    },
                    default: "cancelDmCampaign",
                    options: [
                        {
                            name: "Cancel A Campaign'S Unsent Messages",
                            value: "cancelDmCampaign",
                            action: "Cancel campaign s unsent messages dms",
                            description: "Deletes every message of this campaign still waiting to go out,. dms."
                        },
                        {
                            name: "DM Allowances And Usage",
                            value: "getDmLimits",
                            action: "Dm allowances and usage",
                            description: "The account's dm caps and how much of each is used. these are plan."
                        },
                        {
                            name: "List The DM Queue",
                            value: "listDmQueue",
                            action: "List dm queue",
                            description: "The account's bulk dm rows, newest first: what is waiting, what went"
                        },
                        {
                            name: "Queue A DM Campaign",
                            value: "queueDmCampaign",
                            action: "Queue dm campaign",
                            description: "Queues direct messages to up to 100 x users. dms."
                        },
                        {
                            name: "Read One DM Campaign",
                            value: "getDmCampaign",
                            action: "Read one dm campaign",
                            description: "The messages this campaign queued, with a count per status. dms."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the dm campaign to delete",
                    displayOptions: {
                        show: {
                            resource: [
                                "dms"
                            ],
                            operation: [
                                "cancelDmCampaign"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "dms"
                            ],
                            operation: [
                                "cancelDmCampaign"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the dm campaign to retrieve",
                    displayOptions: {
                        show: {
                            resource: [
                                "dms"
                            ],
                            operation: [
                                "getDmCampaign"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "dms"
                            ],
                            operation: [
                                "getDmCampaign"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "dms"
                            ],
                            operation: [
                                "getDmLimits"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "dms"
                            ],
                            operation: [
                                "listDmQueue"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        },
                        {
                            displayName: "Campaign ID",
                            name: "campaign_id",
                            type: "string",
                            default: "",
                            description: "Filter queue items to a specific campaign ID"
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Offset",
                            name: "offset",
                            type: "number",
                            default: 0,
                            description: "Number of queue items to skip before returning results",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Status",
                            name: "status",
                            type: "options",
                            default: "pending",
                            description: "Filter queue items by status",
                            options: [
                                {
                                    name: "Failed",
                                    value: "failed"
                                },
                                {
                                    name: "Pending",
                                    value: "pending"
                                },
                                {
                                    name: "Sending",
                                    value: "sending"
                                },
                                {
                                    name: "Sent",
                                    value: "sent"
                                },
                                {
                                    name: "Skipped",
                                    value: "skipped"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "Recipients",
                    name: "recipients",
                    type: "json",
                    default: [],
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "dms"
                            ],
                            operation: [
                                "queueDmCampaign"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "dms"
                            ],
                            operation: [
                                "queueDmCampaign"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Any account you own, meaning your main account (the default when omitted) or one linked to it. an account shared with you returns `403 writes_main_account_only`."
                        },
                        {
                            displayName: "Idempotency Key",
                            name: "Idempotency-Key",
                            type: "string",
                            default: "",
                            description: "Unique key (max 64 characters) for safe retries. replays carry the \"idempotency-replayed\" response header set to \"true\". keys are retained for 24 hours."
                        },
                        {
                            displayName: "Message",
                            name: "message",
                            type: "string",
                            default: "",
                            description: "The shared message. required unless every recipient carries its own."
                        },
                        {
                            displayName: "Spread",
                            name: "spread",
                            type: "boolean",
                            default: false,
                            description: "Whether spread what today's daily allowance cannot hold over the coming days instead of skipping it. ignored when `get /v1/dm/limits` reports `scheduling_enabled: false`; the overflow is then counted in `skipped`."
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "engage"
                            ]
                        }
                    },
                    default: "createEngageFeed",
                    options: [
                        {
                            name: "Create An Engage Feed",
                            value: "createEngageFeed",
                            action: "Create engage feed",
                            description: "Save a new engage feed on the account: a set of keywords, a public x"
                        },
                        {
                            name: "Delete An Engage Feed",
                            value: "deleteEngageFeed",
                            action: "Delete engage feed",
                            description: "Remove a saved feed. if it was the feed the superx app has open, the. engage."
                        },
                        {
                            name: "Draft One Reply To A Post",
                            value: "draftEngageReply",
                            action: "Draft one reply to a post engage",
                            description: "Writes one reply draft in the account's own voice, using the same. engage."
                        },
                        {
                            name: "Get Mentions Of The Account",
                            value: "getMentions",
                            action: "Get mentions of the account engage",
                            description: "The posts that @-mention the selected account right now, newest first. engage."
                        },
                        {
                            name: "Get Posts From An Engage Feed",
                            value: "getEngageFeedPosts",
                            action: "Get posts from an engage feed",
                            description: "Candidate posts from one saved feed, with the author profile and. engage."
                        },
                        {
                            name: "List Engage Feeds",
                            value: "listEngageFeeds",
                            action: "List engage feeds",
                            description: "The account's saved engage feeds: the keyword and list feeds it"
                        },
                        {
                            name: "Update An Engage Feed",
                            value: "updateEngageFeed",
                            action: "Update engage feed",
                            description: "Rename a saved feed, replace what it watches, or both. send at most. engage."
                        }
                    ]
                },
                {
                    displayName: "Name",
                    name: "name",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Feed name shown in superx",
                    displayOptions: {
                        show: {
                            resource: [
                                "engage"
                            ],
                            operation: [
                                "createEngageFeed"
                            ]
                        }
                    }
                },
                {
                    displayName: "Type",
                    name: "type",
                    type: "options",
                    default: "keywords",
                    required: true,
                    description: "Must match the source fields sent below",
                    options: [
                        {
                            name: "Keywords",
                            value: "keywords"
                        },
                        {
                            name: "List",
                            value: "list"
                        },
                        {
                            name: "X List",
                            value: "x_list"
                        }
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "engage"
                            ],
                            operation: [
                                "createEngageFeed"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "engage"
                            ],
                            operation: [
                                "createEngageFeed"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Any account you own, meaning your main account (the default when omitted) or one linked to it. an account shared with you returns `403 writes_main_account_only`."
                        },
                        {
                            displayName: "Keywords",
                            name: "keywords",
                            type: "json",
                            default: [],
                            description: "For type keywords. trimmed, de-duplicated case-insensitively."
                        },
                        {
                            displayName: "List ID",
                            name: "list_id",
                            type: "string",
                            default: "",
                            description: "For type list. a contact list ID from `get /v1/contact-lists`."
                        },
                        {
                            displayName: "X List ID",
                            name: "x_list_id",
                            type: "string",
                            default: "",
                            description: "For type x_list. a numeric x list ID. use this or x_list_url."
                        },
                        {
                            displayName: "X List URL",
                            name: "x_list_url",
                            type: "string",
                            default: "",
                            description: "For type x_list. a link like https://x.com/i/lists/1234567890."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The feed ID (from `get /v1/engage/feeds`)",
                    displayOptions: {
                        show: {
                            resource: [
                                "engage"
                            ],
                            operation: [
                                "deleteEngageFeed"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "engage"
                            ],
                            operation: [
                                "deleteEngageFeed"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "engage"
                            ],
                            operation: [
                                "draftEngageReply"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Conversation",
                            name: "conversation",
                            type: "json",
                            default: [],
                            description: "The thread so far, oldest first, so the reply fits the conversation"
                        },
                        {
                            displayName: "Post",
                            name: "post",
                            type: "collection",
                            default: {
                                text: ""
                            },
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Author Handle",
                                    name: "author_handle",
                                    type: "string",
                                    default: "",
                                    description: "The author's handle. a leading @ is accepted and stripped."
                                },
                                {
                                    displayName: "Author Name",
                                    name: "author_name",
                                    type: "string",
                                    default: "",
                                    description: "The author's display name"
                                },
                                {
                                    displayName: "Text",
                                    name: "text",
                                    type: "string",
                                    default: ""
                                }
                            ],
                            description: "A post, supplied by you rather than read from x"
                        },
                        {
                            displayName: "Post ID",
                            name: "post_id",
                            type: "string",
                            default: "",
                            description: "An x post ID. the API reads the post live, which costs one live lookup on top of the credit.",
                            hint: "Expected format: ^[0-9]{1,25}$"
                        },
                        {
                            displayName: "Quoted Post",
                            name: "quoted_post",
                            type: "collection",
                            default: {
                                text: ""
                            },
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Author Handle",
                                    name: "author_handle",
                                    type: "string",
                                    default: "",
                                    description: "The author's handle. a leading @ is accepted and stripped."
                                },
                                {
                                    displayName: "Author Name",
                                    name: "author_name",
                                    type: "string",
                                    default: "",
                                    description: "The author's display name"
                                },
                                {
                                    displayName: "Text",
                                    name: "text",
                                    type: "string",
                                    default: ""
                                }
                            ],
                            description: "The post that the post being replied to quotes. filled in automatically when you pass post_id."
                        },
                        {
                            displayName: "Thoughts",
                            name: "thoughts",
                            type: "string",
                            default: "",
                            description: "What the person wants the reply to convey. ask them; do not invent an opinion for them."
                        },
                        {
                            displayName: "Tone",
                            name: "tone",
                            type: "options",
                            default: "engaging",
                            options: [
                                {
                                    name: "Concise",
                                    value: "concise"
                                },
                                {
                                    name: "Creative",
                                    value: "creative"
                                },
                                {
                                    name: "Engaging",
                                    value: "engaging"
                                },
                                {
                                    name: "Humorous",
                                    value: "humorous"
                                },
                                {
                                    name: "Inspirational",
                                    value: "inspirational"
                                },
                                {
                                    name: "Sarcastic",
                                    value: "sarcastic"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Feed ID from `get /v1/engage/feeds`",
                    displayOptions: {
                        show: {
                            resource: [
                                "engage"
                            ],
                            operation: [
                                "getEngageFeedPosts"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "engage"
                            ],
                            operation: [
                                "getEngageFeedPosts"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        },
                        {
                            displayName: "Exclude Post IDs",
                            name: "exclude_post_ids",
                            type: "string",
                            default: "",
                            description: "Comma-separated post IDs to leave out, up to 100. this is how you page."
                        },
                        {
                            displayName: "Fresh",
                            name: "fresh",
                            type: "boolean",
                            default: false,
                            description: "Whether skip the short-lived result cache and refetch. default false."
                        },
                        {
                            displayName: "Include Replied",
                            name: "include_replied",
                            type: "boolean",
                            default: false,
                            description: "Whether keep posts the account already replied to, flagged with `replied: true`. default false removes them."
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Mode",
                            name: "mode",
                            type: "options",
                            default: "top",
                            description: "Ranking for keyword feeds. `top` (default) blends quality and relevance, `latest` is pure recency.",
                            options: [
                                {
                                    name: "Latest",
                                    value: "latest"
                                },
                                {
                                    name: "Top",
                                    value: "top"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "engage"
                            ],
                            operation: [
                                "getMentions"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        },
                        {
                            displayName: "Cursor",
                            name: "cursor",
                            type: "string",
                            default: "",
                            description: "Next_cursor from the previous page. omit for the first page."
                        },
                        {
                            displayName: "Include Replied",
                            name: "include_replied",
                            type: "boolean",
                            default: false,
                            description: "Whether keep mentions already replied to, flagged with `replied`"
                        },
                        {
                            displayName: "Sort",
                            name: "sort",
                            type: "options",
                            default: "latest",
                            description: "Choose whether to sort mentions by recency or popularity",
                            options: [
                                {
                                    name: "Latest",
                                    value: "latest"
                                },
                                {
                                    name: "Top",
                                    value: "top"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "engage"
                            ],
                            operation: [
                                "listEngageFeeds"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The feed ID (from `get /v1/engage/feeds`)",
                    displayOptions: {
                        show: {
                            resource: [
                                "engage"
                            ],
                            operation: [
                                "updateEngageFeed"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "engage"
                            ],
                            operation: [
                                "updateEngageFeed"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Any account you own, meaning your main account (the default when omitted) or one linked to it. an account shared with you returns `403 writes_main_account_only`."
                        },
                        {
                            displayName: "Keywords",
                            name: "keywords",
                            type: "json",
                            default: [],
                            description: "Replace the feed's keywords (makes it a keyword feed)"
                        },
                        {
                            displayName: "List ID",
                            name: "list_id",
                            type: "string",
                            default: "",
                            description: "Point the feed at this contact list"
                        },
                        {
                            displayName: "Name",
                            name: "name",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "X List ID",
                            name: "x_list_id",
                            type: "string",
                            default: "",
                            description: "Point the feed at this numeric x list ID. use this or x_list_url."
                        },
                        {
                            displayName: "X List URL",
                            name: "x_list_url",
                            type: "string",
                            default: "",
                            description: "Point the feed at this x list link"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "identity"
                            ]
                        }
                    },
                    default: "getMe",
                    options: [
                        {
                            name: "Get The Key Owner",
                            value: "getMe",
                            action: "Get key owner identity",
                            description: "Returns the key owner, their plan, the calling key's name and scopes, and the ai credit pool. identity."
                        },
                        {
                            name: "List Your Accounts",
                            value: "listAccounts",
                            action: "List your accounts identity",
                            description: "The accounts this key may act on: your main account plus any linked. identity."
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "inspiration"
                            ]
                        }
                    },
                    default: "searchInspiration",
                    options: [
                        {
                            name: "Search The Inspiration Library",
                            value: "searchInspiration",
                            action: "Search inspiration library",
                            description: "Search a library of 50m+ real high-performing posts by topic. use the. inspiration."
                        },
                        {
                            name: "Search The Inspiration Media Index",
                            value: "searchInspirationMedia",
                            action: "Search inspiration media index",
                            description: "Search the cross-platform media index behind the superx app's. inspiration."
                        }
                    ]
                },
                {
                    displayName: "Q",
                    name: "q",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Topic or theme to search for (1-200 characters)",
                    displayOptions: {
                        show: {
                            resource: [
                                "inspiration"
                            ],
                            operation: [
                                "searchInspiration"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "inspiration"
                            ],
                            operation: [
                                "searchInspiration"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Exclude Topics",
                            name: "exclude_topics",
                            type: "string",
                            default: "",
                            description: "Comma-separated topics to exclude (keyword filter)",
                            placeholder: "e.g. crypto,politics"
                        },
                        {
                            displayName: "Lang",
                            name: "lang",
                            type: "string",
                            default: "en",
                            description: "Language code"
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Max Followers",
                            name: "max_followers",
                            type: "number",
                            default: 0,
                            description: "Only posts from authors with at most this many followers",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Min Bookmarks",
                            name: "min_bookmarks",
                            type: "number",
                            default: 0,
                            description: "Only posts with at least this many bookmarks",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Min Followers",
                            name: "min_followers",
                            type: "number",
                            default: 0,
                            description: "Only posts from authors with at least this many followers",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Min Impressions",
                            name: "min_impressions",
                            type: "number",
                            default: 0,
                            description: "Only posts with at least this many impressions",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Min Length",
                            name: "min_length",
                            type: "number",
                            default: 0,
                            description: "Only posts with at least this many characters",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Min Likes",
                            name: "min_likes",
                            type: "number",
                            default: 0,
                            description: "Only posts with at least this many likes",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Min Replies",
                            name: "min_replies",
                            type: "number",
                            default: 0,
                            description: "Only posts with at least this many replies",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Min Reposts",
                            name: "min_reposts",
                            type: "number",
                            default: 0,
                            description: "Only posts with at least this many reposts",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 1,
                            description: "1-based page number, 1 to 7",
                            typeOptions: {
                                minValue: 1,
                                maxValue: 7
                            }
                        },
                        {
                            displayName: "Since",
                            name: "since",
                            type: "dateTime",
                            default: "",
                            description: "UTC ISO-8601 lower bound (explicit z or offset required)"
                        },
                        {
                            displayName: "Sort",
                            name: "sort",
                            type: "options",
                            default: "relevant",
                            description: "Result ordering. `relevant` (default) is relevance-ranked, the strongest matches first.",
                            options: [
                                {
                                    name: "Impressions",
                                    value: "impressions"
                                },
                                {
                                    name: "Likes",
                                    value: "likes"
                                },
                                {
                                    name: "Outlier",
                                    value: "outlier"
                                },
                                {
                                    name: "Recent",
                                    value: "recent"
                                },
                                {
                                    name: "Relevant",
                                    value: "relevant"
                                },
                                {
                                    name: "Reposts",
                                    value: "reposts"
                                }
                            ]
                        },
                        {
                            displayName: "Until",
                            name: "until",
                            type: "dateTime",
                            default: "",
                            description: "UTC ISO-8601 upper bound (explicit z or offset required)"
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "inspiration"
                            ],
                            operation: [
                                "searchInspirationMedia"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Content Type",
                            name: "content_type",
                            type: "string",
                            default: "",
                            description: "Free-text content-type label as stored in the index (max 50 characters). there is no enumerated list: a label the index does not use returns zero items and still counts against the daily search cap, so leave it off unless you know the label."
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Media Type",
                            name: "media_type",
                            type: "options",
                            default: "all",
                            description: "Media kind",
                            options: [
                                {
                                    name: "All",
                                    value: "all"
                                },
                                {
                                    name: "Image",
                                    value: "image"
                                },
                                {
                                    name: "Video",
                                    value: "video"
                                }
                            ]
                        },
                        {
                            displayName: "Platforms",
                            name: "platforms",
                            type: "string",
                            default: "",
                            description: "Comma-separated platforms to include. default: `instagram,youtube,x,threads`.",
                            placeholder: "e.g. youtube,instagram"
                        },
                        {
                            displayName: "Q",
                            name: "q",
                            type: "string",
                            default: "",
                            description: "What to search for (max 300 characters). omit to browse the newest media."
                        },
                        {
                            displayName: "Time Filter",
                            name: "time_filter",
                            type: "options",
                            default: "all",
                            description: "How recent the media must be",
                            options: [
                                {
                                    name: "24h",
                                    value: "24h"
                                },
                                {
                                    name: "30d",
                                    value: "30d"
                                },
                                {
                                    name: "7d",
                                    value: "7d"
                                },
                                {
                                    name: "All",
                                    value: "all"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "media"
                            ]
                        }
                    },
                    default: "createMediaUpload",
                    options: [
                        {
                            name: "Presign An Image Upload",
                            value: "createMediaUpload",
                            action: "Presign image upload media",
                            description: "Registers an image upload and returns a presigned `upload_url`. put. media."
                        }
                    ]
                },
                {
                    displayName: "File Type",
                    name: "file_type",
                    type: "options",
                    default: "image/jpeg",
                    required: true,
                    options: [
                        {
                            name: "Image/Gif",
                            value: "image/gif"
                        },
                        {
                            name: "Image/Jpeg",
                            value: "image/jpeg"
                        },
                        {
                            name: "Image/Png",
                            value: "image/png"
                        },
                        {
                            name: "Image/Webp",
                            value: "image/webp"
                        }
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "media"
                            ],
                            operation: [
                                "createMediaUpload"
                            ]
                        }
                    }
                },
                {
                    displayName: "Filename",
                    name: "filename",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Original filename; sanitized into the object key",
                    displayOptions: {
                        show: {
                            resource: [
                                "media"
                            ],
                            operation: [
                                "createMediaUpload"
                            ]
                        }
                    }
                },
                {
                    displayName: "Size",
                    name: "size",
                    type: "number",
                    default: 0,
                    required: true,
                    description: "File size in bytes. 5 mb max (15 mb for gif).",
                    displayOptions: {
                        show: {
                            resource: [
                                "media"
                            ],
                            operation: [
                                "createMediaUpload"
                            ]
                        }
                    }
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "meta"
                            ]
                        }
                    },
                    default: "getDocs",
                    options: [
                        {
                            name: "Machine Readable Quickstart",
                            value: "getDocs",
                            action: "Machine readable quickstart meta",
                            description: "A short markdown quickstart (auth header, base URL, endpoint list, rate limits). no authentication required. meta."
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "queue"
                            ]
                        }
                    },
                    default: "getQueueSettings",
                    options: [
                        {
                            name: "Get Queue Settings",
                            value: "getQueueSettings",
                            action: "Get queue settings",
                            description: "Returns posting slots (`{ time, days }`) and timezone for the account. weekdays use `0` for sunday; `slot_count` counts each time/day pair. default flags show whether superx supplies the value. supports main, linked, and shared accounts. queue."
                        },
                        {
                            name: "Update Queue Settings",
                            value: "updateQueueSettings",
                            action: "Update queue settings",
                            description: "Updates `slots`, `timezone`, or both; omitted fields stay unchanged. `slots` replaces the full list (max 50 unique times; each slot needs a weekday, with `0` for sunday). send `[]` to clear predefined slots. queue."
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "queue"
                            ],
                            operation: [
                                "getQueueSettings"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "queue"
                            ],
                            operation: [
                                "updateQueueSettings"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        },
                        {
                            displayName: "Account ID (Body)",
                            name: "account_idBody",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Slots",
                            name: "slots",
                            type: "json",
                            default: [],
                            description: "Full replace of the predefined posting slots. `[]` clears them all."
                        },
                        {
                            displayName: "Timezone",
                            name: "timezone",
                            type: "string",
                            default: "",
                            description: "Iana timezone name the slot times run in, for example `europe/london`"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "scheduling"
                            ]
                        }
                    },
                    default: "bulkDeleteScheduledPosts",
                    options: [
                        {
                            name: "Create A Draft Or Scheduled Post, Or Publish Now",
                            value: "createScheduledPost",
                            action: "Create draft or scheduled post or publish now scheduling",
                            description: "Creates a post: a draft when `scheduled_for` is omitted, a scheduled. scheduling."
                        },
                        {
                            name: "Delete A Draft Or Scheduled Post",
                            value: "deleteScheduledPost",
                            action: "Delete draft or scheduled post scheduling",
                            description: "Deletes the post and refunds any quota it held. works for your main account or any account linked to it (`account_id`); accounts shared with you are read-only. scheduling."
                        },
                        {
                            name: "Delete Queued Posts In Bulk",
                            value: "bulkDeleteScheduledPosts",
                            action: "Delete queued posts in bulk scheduling",
                            description: "Deletes up to 100 queued posts at once and refunds their post quota. scheduling."
                        },
                        {
                            name: "Edit A Draft Or Scheduled Post",
                            value: "updateScheduledPost",
                            action: "Edit draft or scheduled post scheduling",
                            description: "Partial update: only the fields you send change; everything else on. scheduling."
                        },
                        {
                            name: "Enable Auto Retweet On Queued Posts In Bulk",
                            value: "bulkEnableAutoRetweet",
                            action: "Enable auto retweet on queued posts in bulk scheduling",
                            description: "Turns auto retweet on for up to 100 queued posts at once. scheduling."
                        },
                        {
                            name: "List Drafts And Scheduled Posts",
                            value: "listScheduledPosts",
                            action: "List drafts and scheduled posts scheduling",
                            description: "The account's drafts and scheduled posts, most recently updated first,. scheduling."
                        },
                        {
                            name: "List Plug Templates",
                            value: "listPlugTemplates",
                            action: "List plug templates scheduling",
                            description: "Lists auto-plug templates created in superx. pass a template ID as `auto_plug.template_id` when creating or updating a scheduled post. scheduling."
                        },
                        {
                            name: "Retime Queued Posts In Bulk",
                            value: "bulkRetimeScheduledPosts",
                            action: "Retime queued posts in bulk scheduling",
                            description: "Moves up to 500 queued posts to new times in one transaction: either. scheduling."
                        },
                        {
                            name: "Rewrite A Post In Your Voice",
                            value: "remixPost",
                            action: "Rewrite post in your voice scheduling",
                            description: "Rewrites a post in the account's own voice, as close to or as far from. scheduling."
                        },
                        {
                            name: "Write Post Drafts In Your Voice",
                            value: "draftPost",
                            action: "Write post drafts in your voice scheduling",
                            description: "Writes post drafts from a brief, in the account's own voice. nothing. scheduling."
                        }
                    ]
                },
                {
                    displayName: "IDs",
                    name: "ids",
                    type: "json",
                    default: [],
                    required: true,
                    description: "Post IDs (from `get /v1/scheduled-posts`). repeated IDs are deduplicated.",
                    displayOptions: {
                        show: {
                            resource: [
                                "scheduling"
                            ],
                            operation: [
                                "bulkDeleteScheduledPosts"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "scheduling"
                            ],
                            operation: [
                                "bulkDeleteScheduledPosts"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Any account you own. an account shared with you returns `403 writes_main_account_only`."
                        }
                    ]
                },
                {
                    displayName: "Auto Retweet",
                    name: "auto_retweet",
                    type: "collection",
                    default: {
                        after_hours: 0
                    },
                    placeholder: "Add Field",
                    options: [
                        {
                            displayName: "After Hours",
                            name: "after_hours",
                            type: "number",
                            default: 0,
                            description: "Retweet each post this many hours after it goes live",
                            typeOptions: {
                                minValue: 1,
                                maxValue: 12
                            }
                        },
                        {
                            displayName: "Remove After Hours",
                            name: "remove_after_hours",
                            type: "number",
                            default: 0,
                            description: "Remove the retweet this many hours later. omit to keep it.",
                            typeOptions: {
                                minValue: 1,
                                maxValue: 12
                            }
                        }
                    ],
                    required: true,
                    description: "The auto retweet to apply to every listed post",
                    displayOptions: {
                        show: {
                            resource: [
                                "scheduling"
                            ],
                            operation: [
                                "bulkEnableAutoRetweet"
                            ]
                        }
                    }
                },
                {
                    displayName: "IDs",
                    name: "ids",
                    type: "json",
                    default: [],
                    required: true,
                    description: "Post IDs (from `get /v1/scheduled-posts`). repeated IDs are deduplicated.",
                    displayOptions: {
                        show: {
                            resource: [
                                "scheduling"
                            ],
                            operation: [
                                "bulkEnableAutoRetweet"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "scheduling"
                            ],
                            operation: [
                                "bulkEnableAutoRetweet"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Any account you own. an account shared with you returns `403 writes_main_account_only`."
                        }
                    ]
                },
                {
                    displayName: "Moves",
                    name: "moves",
                    type: "json",
                    default: [],
                    required: true,
                    description: "The moves to apply. post IDs must be unique within one call.",
                    displayOptions: {
                        show: {
                            resource: [
                                "scheduling"
                            ],
                            operation: [
                                "bulkRetimeScheduledPosts"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "scheduling"
                            ],
                            operation: [
                                "bulkRetimeScheduledPosts"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Any account you own. an account shared with you returns `403 writes_main_account_only`."
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "scheduling"
                            ],
                            operation: [
                                "createScheduledPost"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Any account you own, meaning your main account (the default when omitted) or one linked to it. an account shared with you returns `403 writes_main_account_only`."
                        },
                        {
                            displayName: "Auto Delete",
                            name: "auto_delete",
                            type: "json",
                            default: {},
                            description: "Auto delete underperforming posts. omit to inherit your defaults; `null` turns it off for this post."
                        },
                        {
                            displayName: "Auto Dm",
                            name: "auto_dm",
                            type: "json",
                            default: {},
                            description: "Auto dm: message the people who reply to or repost this post once it is live. omit to inherit your defaults; `null` turns it off for this post."
                        },
                        {
                            displayName: "Auto Plug",
                            name: "auto_plug",
                            type: "json",
                            default: {},
                            description: "Auto plug: reply with a template once the post hits a likes threshold. omit to inherit your defaults; `null` turns it off for this post. unknown template IDs fail with `400 unknown_plug_template`."
                        },
                        {
                            displayName: "Auto Retweet",
                            name: "auto_retweet",
                            type: "json",
                            default: {},
                            description: "Auto retweet. omit to inherit your default post settings; `null` turns it off for this post."
                        },
                        {
                            displayName: "Idempotency Key",
                            name: "Idempotency-Key",
                            type: "string",
                            default: "",
                            description: "Unique key (max 64 characters) for safe retries. replays carry the \"idempotency-replayed\" response header set to \"true\". keys are retained for 24 hours."
                        },
                        {
                            displayName: "Parts",
                            name: "parts",
                            type: "json",
                            default: [],
                            description: "Thread parts, 1 to 25 items. total text across parts is limited to 25,000 characters."
                        },
                        {
                            displayName: "Scheduled For",
                            name: "scheduled_for",
                            type: "dateTime",
                            default: {
                                schemaAlternative: "alternative1",
                                value: ""
                            },
                            description: "UTC ISO-8601 with explicit z or offset: at least 60 seconds in the future, at most 18 months out. omit to create a draft. the literal string `\"now\"` publishes to x immediately and requires an `idempotency-key` (see the operation description)."
                        },
                        {
                            displayName: "Scratchpad",
                            name: "scratchpad",
                            type: "string",
                            default: "",
                            description: "Private working notes attached to the post. never posted."
                        },
                        {
                            displayName: "Super Followers Only",
                            name: "super_followers_only",
                            type: "boolean",
                            default: false,
                            description: "Whether post to super followers only. omit to inherit your defaults."
                        },
                        {
                            displayName: "Tags",
                            name: "tags",
                            type: "json",
                            default: [],
                            description: "Tag IDs to assign (from `get /v1/tags`). unknown IDs fail the whole request with `400 unknown_tag` before anything is created."
                        },
                        {
                            displayName: "Text",
                            name: "text",
                            type: "string",
                            default: "",
                            description: "The post text (single post). provide either `text` or `parts`."
                        },
                        {
                            displayName: "Title",
                            name: "title",
                            type: "string",
                            default: "",
                            description: "Draft title shown in the superx app. organizational only, never posted."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the draft or scheduled post to delete",
                    displayOptions: {
                        show: {
                            resource: [
                                "scheduling"
                            ],
                            operation: [
                                "deleteScheduledPost"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "scheduling"
                            ],
                            operation: [
                                "deleteScheduledPost"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        }
                    ]
                },
                {
                    displayName: "Brief",
                    name: "brief",
                    type: "string",
                    default: "",
                    required: true,
                    description: "What the post should say: the data, angle, or notes to write from",
                    displayOptions: {
                        show: {
                            resource: [
                                "scheduling"
                            ],
                            operation: [
                                "draftPost"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "scheduling"
                            ],
                            operation: [
                                "draftPost"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Any account you own, meaning your main account (the default when omitted) or one linked to it. with `voice: mine` the drafts use this account's own posts and style guide. an account shared with you returns `403 writes_main_account_only`."
                        },
                        {
                            displayName: "Collection",
                            name: "collection",
                            type: "string",
                            default: "",
                            description: "Optional collection ID to guide draft shape (for example, `numbered_list`). used only when `mirror` is omitted. unknown or unusable IDs return `400 invalid_collection` with valid IDs."
                        },
                        {
                            displayName: "Count",
                            name: "count",
                            type: "number",
                            default: 1,
                            description: "How many drafts to write. each one costs credits.",
                            typeOptions: {
                                minValue: 1,
                                maxValue: 3
                            }
                        },
                        {
                            displayName: "Creator",
                            name: "creator",
                            type: "string",
                            default: "",
                            description: "X handle to borrow style from, for example `@naval`. required when `voice` is `creator` or `hybrid`, rejected when `voice` is `mine`."
                        },
                        {
                            displayName: "Instructions",
                            name: "instructions",
                            type: "string",
                            default: "",
                            description: "Extra style instructions for this batch"
                        },
                        {
                            displayName: "Mirror",
                            name: "mirror",
                            type: "string",
                            default: "",
                            description: "Plain text of a proven post whose shape to copy. only the form is reused, never the content. pick a mirror with room for your data: a two-line aphorism squeezes the facts out. omit to have a shape picked for you."
                        },
                        {
                            displayName: "Voice",
                            name: "voice",
                            type: "options",
                            default: "mine",
                            description: "Whose voice to write in. `mine` is the voice of the account in `account_id`: its own posts, style guide and rules. omit `account_id` and that is your main account.",
                            options: [
                                {
                                    name: "Creator",
                                    value: "creator"
                                },
                                {
                                    name: "Hybrid",
                                    value: "hybrid"
                                },
                                {
                                    name: "Mine",
                                    value: "mine"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "scheduling"
                            ],
                            operation: [
                                "listPlugTemplates"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "scheduling"
                            ],
                            operation: [
                                "listScheduledPosts"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        },
                        {
                            displayName: "From",
                            name: "from",
                            type: "dateTime",
                            default: "",
                            description: "Include posts scheduled at or after this UTC ISO-8601 time (explicit z or offset required)"
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 1,
                            description: "1-based page number",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Status",
                            name: "status",
                            type: "string",
                            default: "",
                            description: "Comma list of statuses to include. default is all four. `draft` also covers legacy board drafts stored under internal statuses; they come back as `\"draft\"`.",
                            placeholder: "e.g. scheduled,draft"
                        },
                        {
                            displayName: "Tags",
                            name: "tags",
                            type: "string",
                            default: "",
                            description: "Comma list of tag IDs (from `get /v1/tags`). returns posts carrying any of the listed tags.",
                            placeholder: "e.g. V1StGXR8_Z5jdHi6B-myT"
                        },
                        {
                            displayName: "To",
                            name: "to",
                            type: "dateTime",
                            default: "",
                            description: "Include posts scheduled at or before this UTC ISO-8601 time (explicit z or offset required)"
                        }
                    ]
                },
                {
                    displayName: "Closeness",
                    name: "closeness",
                    type: "number",
                    default: 0,
                    required: true,
                    description: "0 keeps only the idea, 100 stays very close to the original wording",
                    typeOptions: {
                        minValue: 0,
                        maxValue: 100
                    },
                    displayOptions: {
                        show: {
                            resource: [
                                "scheduling"
                            ],
                            operation: [
                                "remixPost"
                            ]
                        }
                    }
                },
                {
                    displayName: "Text",
                    name: "text",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The post to remix",
                    displayOptions: {
                        show: {
                            resource: [
                                "scheduling"
                            ],
                            operation: [
                                "remixPost"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "scheduling"
                            ],
                            operation: [
                                "remixPost"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Instructions",
                            name: "instructions",
                            type: "string",
                            default: "",
                            description: "Extra direction for this remix"
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the draft or scheduled post to update",
                    displayOptions: {
                        show: {
                            resource: [
                                "scheduling"
                            ],
                            operation: [
                                "updateScheduledPost"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "scheduling"
                            ],
                            operation: [
                                "updateScheduledPost"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Any account you own, meaning your main account (the default when omitted) or one linked to it. an account shared with you returns `403 writes_main_account_only`."
                        },
                        {
                            displayName: "Auto Delete",
                            name: "auto_delete",
                            type: "json",
                            default: {},
                            description: "Auto delete override; `null` removes it. omit to keep the current setting."
                        },
                        {
                            displayName: "Auto Dm",
                            name: "auto_dm",
                            type: "json",
                            default: {},
                            description: "Auto dm override; `null` removes it and gives back the month's slot. omit to keep the current setting. when a plan limit stops a new one from attaching, the edit still lands and the response carries `auto_dm_skipped: true`."
                        },
                        {
                            displayName: "Auto Plug",
                            name: "auto_plug",
                            type: "json",
                            default: {},
                            description: "Auto plug override; `null` removes it. omit to keep the current setting. unknown template IDs fail with `400 unknown_plug_template`."
                        },
                        {
                            displayName: "Auto Retweet",
                            name: "auto_retweet",
                            type: "json",
                            default: {},
                            description: "Auto retweet override; `null` removes it. omit to keep the current setting."
                        },
                        {
                            displayName: "Parts",
                            name: "parts",
                            type: "json",
                            default: [],
                            description: "Replacement parts (full replace, media included), 1 to 25 items, 25,000 characters total. a part without `media` drops the media it carried."
                        },
                        {
                            displayName: "Scheduled For",
                            name: "scheduled_for",
                            type: "dateTime",
                            default: "",
                            description: "New time, UTC ISO-8601 with explicit z or offset. on its own it never promotes a draft."
                        },
                        {
                            displayName: "Scratchpad",
                            name: "scratchpad",
                            type: "string",
                            default: "",
                            description: "New notes; `null` clears them"
                        },
                        {
                            displayName: "Status",
                            name: "status",
                            type: "options",
                            default: "draft",
                            description: "Explicit transition. `scheduled` requires a future time (via `scheduled_for` or already stored).",
                            options: [
                                {
                                    name: "Draft",
                                    value: "draft"
                                },
                                {
                                    name: "Scheduled",
                                    value: "scheduled"
                                }
                            ]
                        },
                        {
                            displayName: "Super Followers Only",
                            name: "super_followers_only",
                            type: "boolean",
                            default: false,
                            description: "Whether post to super followers only. omit to keep the current setting."
                        },
                        {
                            displayName: "Tags",
                            name: "tags",
                            type: "json",
                            default: [],
                            description: "Full replacement tag ID set. `[]` clears all tags. unknown IDs fail with `400 unknown_tag`."
                        },
                        {
                            displayName: "Text",
                            name: "text",
                            type: "string",
                            default: "",
                            description: "Replacement text (single post). provide either `text` or `parts`, not both."
                        },
                        {
                            displayName: "Title",
                            name: "title",
                            type: "string",
                            default: "",
                            description: "New title; `null` clears it"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ]
                        }
                    },
                    default: "addSignalAgentSignal",
                    options: [
                        {
                            name: "Add A Signal To An Agent",
                            value: "addSignalAgentSignal",
                            action: "Add signal to an agent",
                            description: "Add one thing for the agent to watch: a search (`keyword_watch`), an. signals."
                        },
                        {
                            name: "Build An Audience Profile From A Website",
                            value: "expandIcpFromUrl",
                            action: "Build audience profile from a website signals",
                            description: "Reads a product or company website and infers who its ideal customers. signals."
                        },
                        {
                            name: "Create A Signal Agent",
                            value: "createSignalAgent",
                            action: "Create signal agent",
                            description: "Create a signal agent: it watches x for the given keywords and scores"
                        },
                        {
                            name: "Delete A Signal Agent",
                            value: "deleteSignalAgent",
                            action: "Delete signal agent",
                            description: "Delete an agent. the leads it already saved and its destination. signals."
                        },
                        {
                            name: "Expand An Audience Description Into A Rubric",
                            value: "expandIcp",
                            action: "Expand audience description into a rubric signals",
                            description: "Turns a plain description of an audience into the structured rubric. signals."
                        },
                        {
                            name: "List Signal Agents",
                            value: "listSignalAgents",
                            action: "List signal agents",
                            description: "The account's signal agents: the automated lead finders from the"
                        },
                        {
                            name: "List Signal Leads",
                            value: "listSignalLeads",
                            action: "List signal leads",
                            description: "The leads the account's signal agents have found, newest first:"
                        },
                        {
                            name: "Remove A Signal From An Agent",
                            value: "removeSignalAgentSignal",
                            action: "Remove signal from an agent",
                            description: "Remove one signal. leads it already found stay, and so does the."
                        },
                        {
                            name: "Search For Leads On X Now",
                            value: "searchLeads",
                            action: "Search for leads on x now signals",
                            description: "One live keyword search over x, scored against an ideal-customer. signals."
                        },
                        {
                            name: "Set Feedback On A Lead",
                            value: "setSignalLeadFeedback",
                            action: "Set feedback on a lead signals",
                            description: "Record the account's verdict on one lead - `fit`, `not_fit`, or. signals."
                        },
                        {
                            name: "Suggest Keyword Watches",
                            value: "suggestKeywords",
                            action: "Suggest keyword watches signals",
                            description: "Turns a plain description of an audience into 2 or 3 keyword-watch. signals."
                        },
                        {
                            name: "Update A Signal Agent",
                            value: "updateSignalAgent",
                            action: "Update signal agent",
                            description: "Edit an agent's `name`, `icp_description`, `precision_mode`,. signals."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "number",
                    default: 0,
                    required: true,
                    description: "The signal agent's numeric ID (from `get /v1/signals/agents`)",
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "addSignalAgentSignal"
                            ]
                        }
                    }
                },
                {
                    displayName: "Type",
                    name: "type",
                    type: "options",
                    default: "keyword_watch",
                    required: true,
                    options: [
                        {
                            name: "Follower Watch",
                            value: "follower_watch"
                        },
                        {
                            name: "Keyword Watch",
                            value: "keyword_watch"
                        },
                        {
                            name: "List Watch",
                            value: "list_watch"
                        },
                        {
                            name: "Profile Watch",
                            value: "profile_watch"
                        }
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "addSignalAgentSignal"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "addSignalAgentSignal"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Any account you own, meaning your main account (the default when omitted) or one linked to it. an account shared with you returns `403 writes_main_account_only`."
                        },
                        {
                            displayName: "Handle",
                            name: "handle",
                            type: "string",
                            default: "",
                            description: "Profile_watch and follower_watch only. an x username, with or without a leading @."
                        },
                        {
                            displayName: "List",
                            name: "list",
                            type: "string",
                            default: "",
                            description: "List_watch only. a public x list ID, or a link like https://x.com/i/lists/1234567890."
                        },
                        {
                            displayName: "Query",
                            name: "query",
                            type: "string",
                            default: "",
                            description: "Keyword_watch only. a plain-language description of what the target customer posts about, or an x search. operators pass through; engagement filters such as min_faves are rejected."
                        }
                    ]
                },
                {
                    displayName: "Icp Description",
                    name: "icp_description",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Who the ideal leads are; found people are scored against this",
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "createSignalAgent"
                            ]
                        }
                    }
                },
                {
                    displayName: "Name",
                    name: "name",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Agent name shown in superx",
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "createSignalAgent"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "createSignalAgent"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Any account you own, meaning your main account (the default when omitted) or one linked to it. an account shared with you returns `403 writes_main_account_only`."
                        },
                        {
                            displayName: "Destination List ID",
                            name: "destination_list_id",
                            type: "string",
                            default: "",
                            description: "Contact list ID (from `get /v1/contact-lists`) that receives the leads. omit to auto-create one."
                        },
                        {
                            displayName: "Idempotency Key",
                            name: "Idempotency-Key",
                            type: "string",
                            default: "",
                            description: "Unique key (max 64 characters) for safe retries. replays carry the \"idempotency-replayed\" response header set to \"true\". keys are retained for 24 hours."
                        },
                        {
                            displayName: "Keywords",
                            name: "keywords",
                            type: "json",
                            default: [],
                            description: "Plain-language descriptions of what the target customer posts about. omit to auto-suggest from the icp. keywords beyond your plan's per-agent signal limit are dropped; the response lists the signals actually created."
                        },
                        {
                            displayName: "Precision Mode",
                            name: "precision_mode",
                            type: "options",
                            default: "high",
                            description: "High = fewer, stricter matches; discovery = broader net",
                            options: [
                                {
                                    name: "Discovery",
                                    value: "discovery"
                                },
                                {
                                    name: "High",
                                    value: "high"
                                }
                            ]
                        },
                        {
                            displayName: "Signals",
                            name: "signals",
                            type: "json",
                            default: [],
                            description: "Non-keyword watches to add alongside `keywords`. combined with `keywords`, at most 5 distinct entries."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "number",
                    default: 0,
                    required: true,
                    description: "The signal agent's numeric ID (from `get /v1/signals/agents`)",
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "deleteSignalAgent"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "deleteSignalAgent"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        }
                    ]
                },
                {
                    displayName: "Icp Description",
                    name: "icp_description",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Who the ideal customer is, in plain language",
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "expandIcp"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "expandIcp"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: ""
                        }
                    ]
                },
                {
                    displayName: "URL",
                    name: "url",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The website to read. a bare domain is accepted.",
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "expandIcpFromUrl"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "expandIcpFromUrl"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: ""
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "listSignalAgents"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "listSignalLeads"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        },
                        {
                            displayName: "Agent ID",
                            name: "agent_id",
                            type: "number",
                            default: 0,
                            description: "Narrow to one agent by its numeric ID (from `get /v1/signals/agents`). an unknown or foreign ID returns 404 `agent_not_found`."
                        },
                        {
                            displayName: "Deposited",
                            name: "deposited",
                            type: "boolean",
                            default: false,
                            description: "Whether true returns only leads already saved to the agent's contact list; false returns only new ones. omit for both."
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 1,
                            description: "1-based page number",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Since",
                            name: "since",
                            type: "dateTime",
                            default: "",
                            description: "UTC ISO-8601 lower bound (explicit z or offset required)"
                        },
                        {
                            displayName: "Until",
                            name: "until",
                            type: "dateTime",
                            default: "",
                            description: "UTC ISO-8601 upper bound (explicit z or offset required)"
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "number",
                    default: 0,
                    required: true,
                    description: "The signal agent's numeric ID (from `get /v1/signals/agents`)",
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "removeSignalAgentSignal"
                            ]
                        }
                    }
                },
                {
                    displayName: "Signal ID",
                    name: "signalId",
                    type: "number",
                    default: 0,
                    required: true,
                    description: "The signal's numeric ID (from the agent's `signals` in `get /v1/signals/agents`)",
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "removeSignalAgentSignal"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "removeSignalAgentSignal"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        }
                    ]
                },
                {
                    displayName: "Icp Description",
                    name: "icp_description",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Who counts as a good lead, in one or two sentences: role, domain, and the buying intent or pain that qualifies them",
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "searchLeads"
                            ]
                        }
                    }
                },
                {
                    displayName: "Keywords",
                    name: "keywords",
                    type: "json",
                    default: {
                        schemaAlternative: "alternative1",
                        value: ""
                    },
                    required: true,
                    description: "Provide 2-5 short buyer-language angles (2-3 words each), such as workflows, paid tools, jargon, or symptoms. use a 3-300 character comma-separated string or string list. do not use the product name, full sentences, or search operators.",
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "searchLeads"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "searchLeads"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Which of your accounts to search as. omit for the main account."
                        },
                        {
                            displayName: "Max Leads",
                            name: "max_leads",
                            type: "number",
                            default: 10,
                            typeOptions: {
                                minValue: 1,
                                maxValue: 30
                            }
                        },
                        {
                            displayName: "Max Post Age Days",
                            name: "max_post_age_days",
                            type: "number",
                            default: 30,
                            description: "Only posts written within the last n days count. older matching posts are skipped and counted in `freshness.stale_skipped`. use 7 for a pain point or buying intent worth catching while it is fresh, 1-3 for today, 30 for anyone who is simply active.",
                            typeOptions: {
                                minValue: 1,
                                maxValue: 90
                            }
                        },
                        {
                            displayName: "Offer",
                            name: "offer",
                            type: "string",
                            default: "",
                            description: "Optional one-sentence description of the product or service. it guides the search toward people discussing the problem, not only those naming the product."
                        },
                        {
                            displayName: "Precision",
                            name: "precision",
                            type: "options",
                            default: "discovery",
                            description: "High keeps only confident matches; discovery also returns adjacent ones",
                            options: [
                                {
                                    name: "Discovery",
                                    value: "discovery"
                                },
                                {
                                    name: "High",
                                    value: "high"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "number",
                    default: 0,
                    required: true,
                    description: "The lead's numeric ID (from `get /v1/signals/leads`)",
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "setSignalLeadFeedback"
                            ]
                        }
                    }
                },
                {
                    displayName: "Feedback",
                    name: "feedback",
                    type: "options",
                    default: "fit",
                    required: true,
                    description: "Fit = a good lead, not_fit = a bad one, null clears the verdict",
                    options: [
                        {
                            name: "Fit",
                            value: "fit"
                        },
                        {
                            name: "Not Fit",
                            value: "not_fit"
                        },
                        {
                            name: "Null",
                            value: "null"
                        }
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "setSignalLeadFeedback"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "setSignalLeadFeedback"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Any account you own, meaning your main account (the default when omitted) or one linked to it. an account shared with you returns `403 writes_main_account_only`."
                        }
                    ]
                },
                {
                    displayName: "Icp Description",
                    name: "icp_description",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Who the ideal customer is, in plain language",
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "suggestKeywords"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "suggestKeywords"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: ""
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "number",
                    default: 0,
                    required: true,
                    description: "The signal agent's numeric ID (from `get /v1/signals/agents`)",
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "updateSignalAgent"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "signals"
                            ],
                            operation: [
                                "updateSignalAgent"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        },
                        {
                            displayName: "Destination List ID",
                            name: "destination_list_id",
                            type: "string",
                            default: "",
                            description: "Contact list ID (from `get /v1/contact-lists`) that receives the leads"
                        },
                        {
                            displayName: "Icp Description",
                            name: "icp_description",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Name",
                            name: "name",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Precision Mode",
                            name: "precision_mode",
                            type: "options",
                            default: "high",
                            options: [
                                {
                                    name: "Discovery",
                                    value: "discovery"
                                },
                                {
                                    name: "High",
                                    value: "high"
                                }
                            ]
                        },
                        {
                            displayName: "Status",
                            name: "status",
                            type: "options",
                            default: "active",
                            options: [
                                {
                                    name: "Active",
                                    value: "active"
                                },
                                {
                                    name: "Paused",
                                    value: "paused"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "tags"
                            ]
                        }
                    },
                    default: "createTag",
                    options: [
                        {
                            name: "Create A",
                            value: "createTag",
                            action: "Create tag",
                            description: "Creates a workspace-wide tag with a unique name. `color` accepts the documented palette and defaults to `blue`. only the main account can write tags; other account IDs return `403 writes_main_account_only`."
                        },
                        {
                            name: "Delete A",
                            value: "deleteTag",
                            action: "Delete tag",
                            description: "Deletes the workspace-wide tag and removes it from attached drafts and scheduled posts; the posts remain. only the main account can write tags; other account IDs return `403 writes_main_account_only`."
                        },
                        {
                            name: "List",
                            value: "listTags",
                            action: "List tags",
                            description: "Tags organize drafts and scheduled posts. they are scoped to the workspace owner and shared across linked accounts. sorted by name a-z."
                        },
                        {
                            name: "Rename Or Recolor A",
                            value: "updateTag",
                            action: "Rename or recolor a tag",
                            description: "Provide `name` and/or `color`. tags are workspace-wide, so this is a main-account write and any other `account_id` returns `403 writes_main_account_only`."
                        }
                    ]
                },
                {
                    displayName: "Name",
                    name: "name",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "tags"
                            ],
                            operation: [
                                "createTag"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "tags"
                            ],
                            operation: [
                                "createTag"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Only your main account (the default when omitted). tags are workspace-wide, so any other account you own returns `403 writes_main_account_only`."
                        },
                        {
                            displayName: "Color",
                            name: "color",
                            type: "color",
                            default: "blue"
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the tag to delete",
                    displayOptions: {
                        show: {
                            resource: [
                                "tags"
                            ],
                            operation: [
                                "deleteTag"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "tags"
                            ],
                            operation: [
                                "deleteTag"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "ID of the tag to update",
                    displayOptions: {
                        show: {
                            resource: [
                                "tags"
                            ],
                            operation: [
                                "updateTag"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "tags"
                            ],
                            operation: [
                                "updateTag"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Only your main account (the default when omitted). tags are workspace-wide, so any other account you own returns `403 writes_main_account_only`."
                        },
                        {
                            displayName: "Color",
                            name: "color",
                            type: "color",
                            default: ""
                        },
                        {
                            displayName: "Name",
                            name: "name",
                            type: "string",
                            default: ""
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "tools"
                            ]
                        }
                    },
                    default: "factCheckText",
                    options: [
                        {
                            name: "Check A Statement Against A Web Search",
                            value: "factCheckText",
                            action: "Check statement against a web search tools",
                            description: "Runs a web search for the statement and reports `true`, `false` or. tools."
                        },
                        {
                            name: "Edit One Selected Piece Of A Post",
                            value: "inlineEditText",
                            action: "Edit one selected piece of a post tools",
                            description: "Edits the piece of a post you select, keeping the style of the text. tools."
                        },
                        {
                            name: "Rewrite A Post One Preset Way",
                            value: "rephraseText",
                            action: "Rewrite post one preset way tools",
                            description: "Applies one preset rewrite to a whole post. tools."
                        },
                        {
                            name: "Score A Draft Against This Account'S Own Posts",
                            value: "postViralScore",
                            action: "Score draft against this account s own posts tools",
                            description: "Scores one draft from 0 to 100 against the account's own recent. tools."
                        },
                        {
                            name: "Sort Recent Posts On Topic Read, Pass Or Not Sure",
                            value: "postTriage",
                            action: "Sort recent posts on topic read pass or not sure tools",
                            description: "Searches recent public posts for a topic and sorts them into three. tools."
                        }
                    ]
                },
                {
                    displayName: "Text",
                    name: "text",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The statement to check",
                    displayOptions: {
                        show: {
                            resource: [
                                "tools"
                            ],
                            operation: [
                                "factCheckText"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "tools"
                            ],
                            operation: [
                                "factCheckText"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: ""
                        }
                    ]
                },
                {
                    displayName: "Text",
                    name: "text",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The selected piece of the post to edit",
                    displayOptions: {
                        show: {
                            resource: [
                                "tools"
                            ],
                            operation: [
                                "inlineEditText"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "tools"
                            ],
                            operation: [
                                "inlineEditText"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Edit Type",
                            name: "edit_type",
                            type: "options",
                            default: "grammar",
                            description: "A preset edit. the last five are older names kept working.",
                            options: [
                                {
                                    name: "Change Tone",
                                    value: "change-tone"
                                },
                                {
                                    name: "Concise",
                                    value: "concise"
                                },
                                {
                                    name: "Creative",
                                    value: "creative"
                                },
                                {
                                    name: "Details",
                                    value: "details"
                                },
                                {
                                    name: "Engaging",
                                    value: "engaging"
                                },
                                {
                                    name: "Expand",
                                    value: "expand"
                                },
                                {
                                    name: "Fix Grammar",
                                    value: "fix-grammar"
                                },
                                {
                                    name: "Grammar",
                                    value: "grammar"
                                },
                                {
                                    name: "Hook",
                                    value: "hook"
                                },
                                {
                                    name: "Humorous",
                                    value: "humorous"
                                },
                                {
                                    name: "Inspirational",
                                    value: "inspirational"
                                },
                                {
                                    name: "Rewrite",
                                    value: "rewrite"
                                },
                                {
                                    name: "Sarcastic",
                                    value: "sarcastic"
                                },
                                {
                                    name: "Simplify",
                                    value: "simplify"
                                },
                                {
                                    name: "Translate",
                                    value: "translate"
                                }
                            ]
                        },
                        {
                            displayName: "Full Text",
                            name: "full_text",
                            type: "string",
                            default: "",
                            description: "The whole post the selection sits in, so the edit matches its style"
                        },
                        {
                            displayName: "Instruction",
                            name: "instruction",
                            type: "string",
                            default: "",
                            description: "Free-text direction, e.g. 'make this one line, lowercase'"
                        },
                        {
                            displayName: "Thread Context",
                            name: "thread_context",
                            type: "json",
                            default: [],
                            description: "The thread's other parts, in order, for context only"
                        }
                    ]
                },
                {
                    displayName: "Query",
                    name: "query",
                    type: "string",
                    default: "",
                    required: true,
                    description: "What to search for, on one line: a topic, a phrase, a hashtag, or a search expression with quotes or operators. a plain multi-word query is also searched as an exact phrase.",
                    displayOptions: {
                        show: {
                            resource: [
                                "tools"
                            ],
                            operation: [
                                "postTriage"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "tools"
                            ],
                            operation: [
                                "postTriage"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Max Age Days",
                            name: "max_age_days",
                            type: "number",
                            default: 3,
                            description: "How far back to search, in days",
                            typeOptions: {
                                minValue: 1,
                                maxValue: 7
                            }
                        }
                    ]
                },
                {
                    displayName: "Text",
                    name: "text",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The draft to score",
                    displayOptions: {
                        show: {
                            resource: [
                                "tools"
                            ],
                            operation: [
                                "postViralScore"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "tools"
                            ],
                            operation: [
                                "postViralScore"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: ""
                        },
                        {
                            displayName: "Baseline",
                            name: "baseline",
                            type: "options",
                            default: "account",
                            description: "`Account` (the default) scores against the account's own recent posts; `population` scores against the average training post. an account with too little history falls back to `population`.",
                            options: [
                                {
                                    name: "Account",
                                    value: "account"
                                },
                                {
                                    name: "Population",
                                    value: "population"
                                }
                            ]
                        },
                        {
                            displayName: "Has Image",
                            name: "has_image",
                            type: "boolean",
                            default: false,
                            description: "Whether true when an image would be attached"
                        },
                        {
                            displayName: "Has Video",
                            name: "has_video",
                            type: "boolean",
                            default: false,
                            description: "Whether true when a video would be attached"
                        },
                        {
                            displayName: "Is Quote",
                            name: "is_quote",
                            type: "boolean",
                            default: false,
                            description: "Whether true when the post quotes another post"
                        },
                        {
                            displayName: "Post At",
                            name: "post_at",
                            type: "dateTime",
                            default: "",
                            description: "When it would go out (ISO-8601 with an explicit z or offset). defaults to now."
                        }
                    ]
                },
                {
                    displayName: "Text",
                    name: "text",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "tools"
                            ],
                            operation: [
                                "rephraseText"
                            ]
                        }
                    }
                },
                {
                    displayName: "Type",
                    name: "type",
                    type: "options",
                    default: "improve",
                    required: true,
                    description: "Which rewrite to apply",
                    options: [
                        {
                            name: "Clarity",
                            value: "clarity"
                        },
                        {
                            name: "Concise",
                            value: "concise"
                        },
                        {
                            name: "Creative",
                            value: "creative"
                        },
                        {
                            name: "Details",
                            value: "details"
                        },
                        {
                            name: "Engaging",
                            value: "engaging"
                        },
                        {
                            name: "Grammar",
                            value: "grammar"
                        },
                        {
                            name: "Hook",
                            value: "hook"
                        },
                        {
                            name: "Humorous",
                            value: "humorous"
                        },
                        {
                            name: "Improve",
                            value: "improve"
                        },
                        {
                            name: "Inspirational",
                            value: "inspirational"
                        },
                        {
                            name: "Positive",
                            value: "positive"
                        },
                        {
                            name: "Sarcastic",
                            value: "sarcastic"
                        },
                        {
                            name: "Translate",
                            value: "translate"
                        }
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "tools"
                            ],
                            operation: [
                                "rephraseText"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "tools"
                            ],
                            operation: [
                                "rephraseText"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: ""
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "workers"
                            ]
                        }
                    },
                    default: "dismissWorkerSuggestion",
                    options: [
                        {
                            name: "Dismiss A Suggestion",
                            value: "dismissWorkerSuggestion",
                            action: "Dismiss suggestion workers",
                            description: "Drop one worker suggestion out of the \"to review\" queue. no post is."
                        },
                        {
                            name: "List",
                            value: "listWorkers",
                            action: "List workers",
                            description: "The account's workers, newest first: the scheduled ai writers set up"
                        },
                        {
                            name: "List Worker Suggestions",
                            value: "listWorkerSuggestions",
                            action: "List worker suggestions",
                            description: "The posts the account's workers wrote, newest first. the default."
                        },
                        {
                            name: "Save A Suggestion As A Draft",
                            value: "draftWorkerSuggestion",
                            action: "Save suggestion as a draft workers",
                            description: "Turn one worker suggestion into a draft post. nothing is posted to x:."
                        },
                        {
                            name: "Schedule A Suggestion",
                            value: "scheduleWorkerSuggestion",
                            action: "Schedule suggestion workers",
                            description: "Turn one worker suggestion into a scheduled post. the superx scheduler."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "number",
                    default: 0,
                    required: true,
                    description: "The suggestion's numeric ID, from `get /v1/workers/suggestions`",
                    typeOptions: {
                        minValue: 1
                    },
                    displayOptions: {
                        show: {
                            resource: [
                                "workers"
                            ],
                            operation: [
                                "dismissWorkerSuggestion"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "workers"
                            ],
                            operation: [
                                "dismissWorkerSuggestion"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Any account you own, meaning your main account (the default when omitted) or one linked to it. an account shared with you returns `403 writes_main_account_only`."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "number",
                    default: 0,
                    required: true,
                    description: "The suggestion's numeric ID, from `get /v1/workers/suggestions`",
                    typeOptions: {
                        minValue: 1
                    },
                    displayOptions: {
                        show: {
                            resource: [
                                "workers"
                            ],
                            operation: [
                                "draftWorkerSuggestion"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "workers"
                            ],
                            operation: [
                                "draftWorkerSuggestion"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Any account you own, meaning your main account (the default when omitted) or one linked to it. an account shared with you returns `403 writes_main_account_only`."
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "workers"
                            ],
                            operation: [
                                "listWorkerSuggestions"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Page",
                            name: "page",
                            type: "number",
                            default: 1,
                            description: "1-based page number",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Status",
                            name: "status",
                            type: "options",
                            default: "to_review",
                            description: "To_review (default) = waiting on a person; drafted, scheduled and dismissed = already acted on; all = every suggestion. a dismissed suggestion reads as dismissed even if it was saved first.",
                            options: [
                                {
                                    name: "All",
                                    value: "all"
                                },
                                {
                                    name: "Dismissed",
                                    value: "dismissed"
                                },
                                {
                                    name: "Drafted",
                                    value: "drafted"
                                },
                                {
                                    name: "Scheduled",
                                    value: "scheduled"
                                },
                                {
                                    name: "To Review",
                                    value: "to_review"
                                }
                            ]
                        },
                        {
                            displayName: "Worker ID",
                            name: "worker_id",
                            type: "number",
                            default: 0,
                            description: "Narrow to one worker by its numeric ID (from `get /v1/workers`). an unknown or foreign ID returns 404 `worker_not_found`."
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "workers"
                            ],
                            operation: [
                                "listWorkers"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Account to act on, from `get /v1/accounts`. defaults to your main account. an ID outside your accounts returns `404 account_not_found`."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "number",
                    default: 0,
                    required: true,
                    description: "The suggestion's numeric ID, from `get /v1/workers/suggestions`",
                    typeOptions: {
                        minValue: 1
                    },
                    displayOptions: {
                        show: {
                            resource: [
                                "workers"
                            ],
                            operation: [
                                "scheduleWorkerSuggestion"
                            ]
                        }
                    }
                },
                {
                    displayName: "Scheduled For",
                    name: "scheduled_for",
                    type: "dateTime",
                    default: "",
                    required: true,
                    description: "When to post it. UTC ISO-8601 with an explicit z or offset, at least 60 seconds in the future.",
                    displayOptions: {
                        show: {
                            resource: [
                                "workers"
                            ],
                            operation: [
                                "scheduleWorkerSuggestion"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "workers"
                            ],
                            operation: [
                                "scheduleWorkerSuggestion"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Account ID",
                            name: "account_id",
                            type: "string",
                            default: "",
                            description: "Any account you own, meaning your main account (the default when omitted) or one linked to it. an account shared with you returns `403 writes_main_account_only`."
                        },
                        {
                            displayName: "Auto Delete",
                            name: "autoDelete",
                            type: "json",
                            default: {},
                            description: "Auto delete settings for this post, in the composer's own shape. omit to leave it off."
                        },
                        {
                            displayName: "Auto Plug",
                            name: "autoPlug",
                            type: "json",
                            default: {},
                            description: "Auto plug settings for this post, in the composer's own shape. omit to leave it off."
                        },
                        {
                            displayName: "Auto Retweet",
                            name: "autoRetweet",
                            type: "json",
                            default: {},
                            description: "Auto retweet settings for this post, in the composer's own shape. omit to leave it off."
                        },
                        {
                            displayName: "Enable Posting Bsky",
                            name: "enablePostingBsky",
                            type: "boolean",
                            default: false,
                            description: "Whether also cross-post it to bluesky. omit to leave the account's own behaviour unchanged."
                        },
                        {
                            displayName: "Enable Posting Twitter",
                            name: "enablePostingTwitter",
                            type: "boolean",
                            default: false,
                            description: "Whether post it to x. omit to leave the account's own behaviour unchanged."
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "xLookups"
                            ]
                        }
                    },
                    default: "getXPostReplies",
                    options: [
                        {
                            name: "Latest Posts Of A Public Account",
                            value: "getXUserPosts",
                            action: "Latest posts of a public account x lookups",
                            description: "One live timeline page (about 20 posts) for any public account,. x lookups."
                        },
                        {
                            name: "Look Up One Public Post Live",
                            value: "lookupXPost",
                            action: "Look up one public post live x lookups",
                            description: "Read one public x post as it is right now: full text (never. x lookups."
                        },
                        {
                            name: "Look Up One Public Profile Live",
                            value: "lookupXUser",
                            action: "Look up one public profile live x lookups",
                            description: "Read one public x profile as it is right now: bio, location, link,. x lookups."
                        },
                        {
                            name: "Top Replies To A Public Post",
                            value: "getXPostReplies",
                            action: "Top replies to a public post x lookups",
                            description: "The best-liked direct replies to a public post, read live from x. x lookups."
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Numeric x post ID",
                    hint: "Expected format: ^[0-9]{1,25}$",
                    displayOptions: {
                        show: {
                            resource: [
                                "xLookups"
                            ],
                            operation: [
                                "getXPostReplies"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "xLookups"
                            ],
                            operation: [
                                "getXPostReplies"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        }
                    ]
                },
                {
                    displayName: "Handle",
                    name: "handle",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The account's @handle, 1-15 letters, numbers or underscores (a leading @ is allowed)",
                    displayOptions: {
                        show: {
                            resource: [
                                "xLookups"
                            ],
                            operation: [
                                "getXUserPosts"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "xLookups"
                            ],
                            operation: [
                                "getXUserPosts"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Exclude Reposts",
                            name: "exclude_reposts",
                            type: "boolean",
                            default: false,
                            description: "Whether return only the account's own posts, dropping reposts"
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            typeOptions: {
                                minValue: 1
                            }
                        }
                    ]
                },
                {
                    displayName: "ID",
                    name: "id",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Numeric x post ID (the digits at the end of a post URL)",
                    hint: "Expected format: ^[0-9]{1,25}$",
                    displayOptions: {
                        show: {
                            resource: [
                                "xLookups"
                            ],
                            operation: [
                                "lookupXPost"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "xLookups"
                            ],
                            operation: [
                                "lookupXPost"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Include Quotes",
                            name: "include_quotes",
                            type: "boolean",
                            default: false,
                            description: "Whether also return a page of the posts quoting this one (up to 20, not exhaustive). costs a second enrichment unit."
                        }
                    ]
                },
                {
                    displayName: "Handle",
                    name: "handle",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The account's @handle, 1-15 letters, numbers or underscores (a leading @ is allowed)",
                    displayOptions: {
                        show: {
                            resource: [
                                "xLookups"
                            ],
                            operation: [
                                "lookupXUser"
                            ]
                        }
                    }
                }
            ]
        };
    }
    async execute() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const inputItems = this.getInputData();
        const output = [];
        for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex += 1) {
            const outputStart = output.length;
            let errorPlan = {};
            try {
                const operation = this.getNodeParameter('operation', itemIndex);
                const nodeVersion = this.getNode().typeVersion;
                let additionalFields = {};
                const nodeOptions = this.getNodeParameter('options', itemIndex, {});
                let retryContract = { mode: 'none', maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0 };
                let credentialApplications;
                let options;
                let pagination = { style: 'none', advancement: '', maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10 * 1024 * 1024, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                let responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                switch (operation) {
                    case "getPostAnalytics": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/posts/analytics";
                        const qs = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        if (additionalFields["since"] !== undefined)
                            qs["since"] = additionalFields["since"];
                        if (additionalFields["until"] !== undefined)
                            qs["until"] = additionalFields["until"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "503": { "title": "Linked-account verification is temporarily unavailable (fail closed). The main account keeps working." } };
                        break;
                    }
                    case "createArticle": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/articles";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["Idempotency-Key"] !== undefined)
                            headers["Idempotency-Key"] = additionalFields["Idempotency-Key"];
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "description": "Any account you own, meaning your main account (the default when omitted) or one linked to it. An account shared with you returns `403 writes_main_account_only`.", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        if (additionalFields["content_markdown"] !== undefined)
                            setBodyField(body, { "name": "content_markdown", "displayName": "Content markdown", "description": "Article body as markdown. Omit for an empty draft.", "type": "string" }, additionalFields["content_markdown"], this, itemIndex);
                        setBodyField(body, { "name": "title", "displayName": "Title", "type": "string", "required": true }, this.getNodeParameter("title", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "warnings"], simplified: ["data", "warnings"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "409": { "title": "Idempotency-Key reused with a different request body." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "deleteArticle": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/articles/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "No article with that id belongs to this account." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "generateArticleCover": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/articles/{id}/cover";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["Idempotency-Key"] !== undefined)
                            headers["Idempotency-Key"] = additionalFields["Idempotency-Key"];
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        if (additionalFields["attach"] !== undefined)
                            setBodyField(body, { "name": "attach", "displayName": "Attach", "type": "boolean", "default": true }, additionalFields["attach"], this, itemIndex);
                        if (additionalFields["style_id"] !== undefined)
                            setBodyField(body, { "name": "style_id", "displayName": "Style id", "description": "A saved cover style id from `GET /v1/cover-styles`. Not accepted together with style_text.", "type": "string" }, additionalFields["style_id"], this, itemIndex);
                        if (additionalFields["style_text"] !== undefined)
                            setBodyField(body, { "name": "style_text", "displayName": "Style text", "description": "Optional one-off style description steering the artwork. Not accepted together with style_id.", "type": "string" }, additionalFields["style_text"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "meta"], simplified: ["data", "meta"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), cover generation disabled (`feature_disabled`), or a lapsed subscription." }, "404": { "title": "No article with that id belongs to this account (`article_not_found`), or the `style_id` is not one of your saved cover styles (`cover_style_not_found`)." }, "409": { "title": "A cover is already being generated for this article (`cover_gen_in_progress`), or the Idempotency-Key was reused with a different body." }, "429": { "title": "Rate limited, generation caps reached (`cover_gen_cap_daily` / `cover_gen_cap_monthly` with counters), or AI credits exhausted (`ai_credits_exhausted`, with the credit counters and `Retry-After`)." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "504": { "title": "AMBIGUOUS timeout. The render may still have completed. GET the article to check its cover before retrying." } };
                        break;
                    }
                    case "getArticle": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/articles/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "No article with that id belongs to this account." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "listArticles": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/articles";
                        const qs = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        if (additionalFields["status"] !== undefined)
                            qs["status"] = additionalFields["status"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "pagination"], simplified: ["data", "pagination"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "listCoverStyles": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/cover-styles";
                        const qs = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "publishArticle": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/articles/{id}/publish";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["Idempotency-Key"] !== undefined)
                            headers["Idempotency-Key"] = additionalFields["Idempotency-Key"];
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "402": { "title": "Post quota exceeded for the current billing period." }, "403": { "title": "Read-only key (`insufficient_scope`), shared account (`writes_main_account_only`), missing X Premium (`x_premium_required`), account reauthorization needed (`reauth_required`), or expired subscription." }, "404": { "title": "No article with that id belongs to this account." }, "409": { "title": "The article's status does not allow publishing (already published, or a publish is in flight)." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "The publish failed (`x_publish_failed`, article returned to draft, quota refunded) or could not be confirmed (`x_publish_ambiguous`, check the article's status)." }, "504": { "title": "AMBIGUOUS timeout. The publish may still have completed. GET the article to check its status before retrying." } };
                        break;
                    }
                    case "scheduleArticle": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/articles/{id}/schedule";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["Idempotency-Key"] !== undefined)
                            headers["Idempotency-Key"] = additionalFields["Idempotency-Key"];
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        setBodyField(body, { "name": "scheduled_for", "displayName": "Scheduled for", "type": "string", "format": "date-time", "required": true }, this.getNodeParameter("scheduled_for", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "402": { "title": "Post quota exceeded for the current billing period." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "No article with that id belongs to this account." }, "409": { "title": "The article's status does not allow scheduling (already published or publishing), or the Idempotency-Key was reused with a different body." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "unscheduleArticle": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/articles/{id}/unschedule";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "No article with that id belongs to this account." }, "409": { "title": "The article is not scheduled." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "updateArticle": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/articles/{id}";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        if (additionalFields["content_markdown"] !== undefined)
                            setBodyField(body, { "name": "content_markdown", "displayName": "Content markdown", "description": "Full replacement body as markdown (max 400KB).", "type": "string" }, additionalFields["content_markdown"], this, itemIndex);
                        if (additionalFields["cover_url"] !== undefined)
                            setBodyField(body, { "name": "cover_url", "displayName": "Cover url", "description": "http(s) image URL to set as the cover, or null to remove it.", "type": "string", "nullable": true }, additionalFields["cover_url"], this, itemIndex);
                        if (additionalFields["title"] !== undefined)
                            setBodyField(body, { "name": "title", "displayName": "Title", "type": "string" }, additionalFields["title"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "PATCH", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "warnings"], simplified: ["data", "warnings"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "No article with that id belongs to this account." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "createContactNote": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/contacts/{id}/notes";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "description": "The account to write as. Defaults to your main account.", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        setBodyField(body, { "name": "body", "displayName": "Body", "type": "string", "required": true }, this.getNodeParameter("body", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "That id is not one of the account's known contacts (`contact_not_found`), or account_id is not one of your accounts (`account_not_found`)." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "deleteContactNote": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/contacts/{id}/notes/{noteId}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        path = path.split("{noteId}").join(encodeURIComponent(String(this.getNodeParameter("noteId", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "No note with that id belongs to this contact (`note_not_found`), or account_id is not one of your accounts (`account_not_found`)." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "getAudience": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/audience/{kind}";
                        const qs = {};
                        const body = {};
                        path = path.split("{kind}").join(encodeURIComponent(String(this.getNodeParameter("kind", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        if (additionalFields["cursor"] !== undefined)
                            qs["cursor"] = additionalFields["cursor"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "meta", "pagination"], simplified: ["data", "meta", "pagination"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "503": { "title": "Linked-account verification is temporarily unavailable (fail closed). The main account keeps working." } };
                        break;
                    }
                    case "getContact": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/contacts/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        if (additionalFields["refresh"] !== undefined)
                            qs["refresh"] = additionalFields["refresh"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "That id is not one of the account's known contacts (`contact_not_found`), or account_id is not one of your accounts (`account_not_found`)." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "listContactNotes": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/contacts/{id}/notes";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "listContactReplies": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/contacts/{id}/replies";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        if (additionalFields["sort"] !== undefined)
                            qs["sort"] = additionalFields["sort"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "pagination"], simplified: ["data", "pagination"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "503": { "title": "Linked-account verification is temporarily unavailable (fail closed). The main account keeps working." } };
                        break;
                    }
                    case "listContacts": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/contacts";
                        const qs = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        if (additionalFields["sort"] !== undefined)
                            qs["sort"] = additionalFields["sort"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "pagination"], simplified: ["data", "pagination"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "503": { "title": "Linked-account verification is temporarily unavailable (fail closed). The main account keeps working." } };
                        break;
                    }
                    case "listReceivedReplies": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/replies/received";
                        const qs = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        if (additionalFields["sort"] !== undefined)
                            qs["sort"] = additionalFields["sort"];
                        if (additionalFields["since"] !== undefined)
                            qs["since"] = additionalFields["since"];
                        if (additionalFields["until"] !== undefined)
                            qs["until"] = additionalFields["until"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "pagination"], simplified: ["data", "pagination"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "503": { "title": "Linked-account verification is temporarily unavailable (fail closed). The main account keeps working." } };
                        break;
                    }
                    case "updateContactNote": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/contacts/{id}/notes/{noteId}";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        path = path.split("{noteId}").join(encodeURIComponent(String(this.getNodeParameter("noteId", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        setBodyField(body, { "name": "body", "displayName": "Body", "type": "string", "required": true }, this.getNodeParameter("body", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "PATCH", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "No note with that id belongs to this contact (`note_not_found`), or account_id is not one of your accounts (`account_not_found`)." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "addContactListMember": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/contact-lists/{id}/members";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        if (additionalFields["handle"] !== undefined)
                            setBodyField(body, { "name": "handle", "displayName": "Handle", "description": "X username, with or without the @.", "type": "string" }, additionalFields["handle"], this, itemIndex);
                        if (additionalFields["x_user_id"] !== undefined)
                            setBodyField(body, { "name": "x_user_id", "displayName": "X user id", "description": "Numeric X user id.", "type": "string" }, additionalFields["x_user_id"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "duplicate"], simplified: ["data", "duplicate"] };
                        errorPlan = { "400": { "title": "A write against a system list (`system_list_read_only`) - renaming or deleting one, or adding/removing its members, singly or in bulk - or a malformed body (`invalid_parameter`)." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "The list id is not one of your lists (`list_not_found`), or the handle did not match an X account (`user_not_found`)." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "addContactListMembers": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/contact-lists/{id}/members/bulk";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        setBodyField(body, { "name": "x_user_ids", "displayName": "X user ids", "description": "Numeric X user ids.", "type": "array", "required": true, "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, this.getNodeParameter("x_user_ids", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A write against a system list (`system_list_read_only`) - renaming or deleting one, or adding/removing its members, singly or in bulk - or a malformed body (`invalid_parameter`)." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "No contact list with that id belongs to this account." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "createContactList": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/contact-lists";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        setBodyField(body, { "name": "name", "displayName": "Name", "type": "string", "required": true }, this.getNodeParameter("name", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "deleteContactList": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/contact-lists/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "A write against a system list (`system_list_read_only`) - renaming or deleting one, or adding/removing its members, singly or in bulk - or a malformed body (`invalid_parameter`)." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "No contact list with that id belongs to this account." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "listContactListMembers": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/contact-lists/{id}/members";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        if (additionalFields["q"] !== undefined)
                            qs["q"] = additionalFields["q"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "pagination"], simplified: ["data", "pagination"] };
                        errorPlan = { "400": { "title": "Member reads on a system list are not supported." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "No contact list with that id belongs to this account." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "listContactLists": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/contact-lists";
                        const qs = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "removeContactListMember": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/contact-lists/{id}/members/{memberId}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        path = path.split("{memberId}").join(encodeURIComponent(String(this.getNodeParameter("memberId", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "A write against a system list (`system_list_read_only`) - renaming or deleting one, or adding/removing its members, singly or in bulk - or a malformed body (`invalid_parameter`)." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "The list id is not one of your lists (`list_not_found`), or the member id is not in that list (`member_not_found`)." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "removeContactListMembers": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/contact-lists/{id}/members/bulk-delete";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        setBodyField(body, { "name": "member_ids", "displayName": "Member ids", "description": "Member ids from `GET /v1/contact-lists/{id}/members`.", "type": "array", "required": true, "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, this.getNodeParameter("member_ids", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A write against a system list (`system_list_read_only`) - renaming or deleting one, or adding/removing its members, singly or in bulk - or a malformed body (`invalid_parameter`)." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "No contact list with that id belongs to this account." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "renameContactList": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/contact-lists/{id}";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        setBodyField(body, { "name": "name", "displayName": "Name", "type": "string", "required": true }, this.getNodeParameter("name", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "PATCH", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A write against a system list (`system_list_read_only`) - renaming or deleting one, or adding/removing its members, singly or in bulk - or a malformed body (`invalid_parameter`)." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "No contact list with that id belongs to this account." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "listPosts": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/posts";
                        const qs = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        if (additionalFields["type"] !== undefined)
                            qs["type"] = additionalFields["type"];
                        if (additionalFields["since"] !== undefined)
                            qs["since"] = additionalFields["since"];
                        if (additionalFields["until"] !== undefined)
                            qs["until"] = additionalFields["until"];
                        if (additionalFields["sort"] !== undefined)
                            qs["sort"] = additionalFields["sort"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "pagination"], simplified: ["data", "pagination"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "503": { "title": "Linked-account verification is temporarily unavailable (fail closed). The main account keeps working." } };
                        break;
                    }
                    case "listReplies": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/replies";
                        const qs = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        if (additionalFields["since"] !== undefined)
                            qs["since"] = additionalFields["since"];
                        if (additionalFields["until"] !== undefined)
                            qs["until"] = additionalFields["until"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "pagination"], simplified: ["data", "pagination"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "503": { "title": "Linked-account verification is temporarily unavailable (fail closed). The main account keeps working." } };
                        break;
                    }
                    case "deleteContextProduct": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/context/products/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Context writes can fail for a read-only key (`insufficient_scope`), an editor-access shared account (`editor_restricted`; only the owner can edit Context), or an expired subscription. These writes do not use `writes_main_account_only`." }, "404": { "title": "No product with that id belongs to this account (`not_found`), or account_id is not one of your accounts (`account_not_found`)." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "getContext": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/context";
                        const qs = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "regenerateStyleGuide": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/context/style-guide/regenerate";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        if (additionalFields["account_idBody"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_idBody"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "meta"], simplified: ["data", "meta"] };
                        errorPlan = { "400": { "title": "The account does not have enough recent posts to read a style from (`not_enough_posts`)." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "429 codes: `rate_limited`, `ai_credits_exhausted`, or `ai_action_limited`. The last uses `scope: account` for plan/feature caps and `platform` for shared live-data caps. Check `reset_at` and honor `Retry-After`; rejected actions are not charged." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "scrapeContextProduct": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/context/products/{id}/scrape";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        if (additionalFields["account_idBody"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_idBody"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "meta"], simplified: ["data", "meta"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Context writes can fail for a read-only key (`insufficient_scope`), an editor-access shared account (`editor_restricted`; only the owner can edit Context), or an expired subscription. These writes do not use `writes_main_account_only`." }, "404": { "title": "No product with that id belongs to this account (`product_not_found`), or account_id is not one of your accounts (`account_not_found`)." }, "422": { "title": "The product page could not be read (`scrape_failed`). The product is unchanged apart from the attempt being recorded." }, "429": { "title": "429 codes: `rate_limited`, `ai_credits_exhausted`, or `ai_action_limited`. The last uses `scope: account` for plan/feature caps and `platform` for shared live-data caps. Check `reset_at` and honor `Retry-After`; rejected actions are not charged." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "setContextProducts": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/context/products";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        if (additionalFields["account_idBody"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_idBody"], this, itemIndex);
                        setBodyField(body, { "name": "products", "displayName": "Products", "type": "array", "required": true, "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "object", "representation": "raw", "fields": [{ "name": "description", "displayName": "Description", "type": "string", "nullable": true }, { "name": "features", "displayName": "Features", "type": "string", "nullable": true }, { "name": "name", "displayName": "Name", "type": "string", "nullable": true }, { "name": "positioning", "displayName": "Positioning", "type": "string", "nullable": true }, { "name": "updates", "displayName": "Updates", "type": "string", "nullable": true }, { "name": "url", "displayName": "Url", "description": "http(s) product url; the upsert key.", "type": "string", "required": true }] } }, this.getNodeParameter("products", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "PUT", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Context writes can fail for a read-only key (`insufficient_scope`), an editor-access shared account (`editor_restricted`; only the owner can edit Context), or an expired subscription. These writes do not use `writes_main_account_only`." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "updateContext": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/context";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        if (additionalFields["account_idBody"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_idBody"], this, itemIndex);
                        if (additionalFields["interests"] !== undefined)
                            setBodyField(body, { "name": "interests", "displayName": "Interests", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, additionalFields["interests"], this, itemIndex);
                        if (additionalFields["profile_description"] !== undefined)
                            setBodyField(body, { "name": "profile_description", "displayName": "Profile description", "type": "object", "representation": "raw", "fields": [{ "name": "enabled", "displayName": "Enabled", "type": "boolean" }, { "name": "text", "displayName": "Text", "type": "string", "nullable": true }] }, additionalFields["profile_description"], this, itemIndex);
                        if (additionalFields["reply"] !== undefined)
                            setBodyField(body, { "name": "reply", "displayName": "Reply", "type": "object", "representation": "raw", "fields": [{ "name": "custom_instructions", "displayName": "Custom instructions", "type": "string", "nullable": true }, { "name": "include_author_name", "displayName": "Include author name", "type": "boolean" }] }, additionalFields["reply"], this, itemIndex);
                        if (additionalFields["rules"] !== undefined)
                            setBodyField(body, { "name": "rules", "displayName": "Rules", "type": "string", "nullable": true }, additionalFields["rules"], this, itemIndex);
                        if (additionalFields["style_guide"] !== undefined)
                            setBodyField(body, { "name": "style_guide", "displayName": "Style guide", "type": "object", "representation": "raw", "fields": [{ "name": "audience_override", "displayName": "Audience override", "type": "string", "nullable": true }, { "name": "vocabulary_override", "displayName": "Vocabulary override", "type": "string", "nullable": true }] }, additionalFields["style_guide"], this, itemIndex);
                        if (additionalFields["voice"] !== undefined)
                            setBodyField(body, { "name": "voice", "displayName": "Voice", "type": "object", "representation": "raw", "fields": [{ "name": "favorite_creators", "displayName": "Favorite creators", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "description": "X username, with or without the leading @.", "type": "alternative", "composition": "oneOf", "representation": "raw", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "description": "X username, with or without the leading @.", "type": "string" }, { "name": "alternative2", "displayName": "Alternative2", "description": "GET output round-trips; fields other than screen_name are ignored and re-derived.", "type": "object", "representation": "raw", "fields": [{ "name": "screen_name", "displayName": "Screen name", "type": "string", "required": true }] }] } }, { "name": "use_own_posts_as_examples", "displayName": "Use own posts as examples", "type": "boolean" }] }, additionalFields["voice"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "PATCH", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "note"], simplified: ["data", "note"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Context writes can fail for a read-only key (`insufficient_scope`), an editor-access shared account (`editor_restricted`; only the owner can edit Context), or an expired subscription. These writes do not use `writes_main_account_only`." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "updateContextProduct": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/context/products/{id}";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        if (additionalFields["account_idBody"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_idBody"], this, itemIndex);
                        if (additionalFields["description"] !== undefined)
                            setBodyField(body, { "name": "description", "displayName": "Description", "type": "string", "nullable": true }, additionalFields["description"], this, itemIndex);
                        if (additionalFields["features"] !== undefined)
                            setBodyField(body, { "name": "features", "displayName": "Features", "type": "string", "nullable": true }, additionalFields["features"], this, itemIndex);
                        if (additionalFields["name"] !== undefined)
                            setBodyField(body, { "name": "name", "displayName": "Name", "type": "string", "nullable": true }, additionalFields["name"], this, itemIndex);
                        if (additionalFields["positioning"] !== undefined)
                            setBodyField(body, { "name": "positioning", "displayName": "Positioning", "type": "string", "nullable": true }, additionalFields["positioning"], this, itemIndex);
                        if (additionalFields["updates"] !== undefined)
                            setBodyField(body, { "name": "updates", "displayName": "Updates", "type": "string", "nullable": true }, additionalFields["updates"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "PATCH", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "Invalid field value (`invalid_parameter`), or the 5-product cap is reached on a create-by-url (`product_limit`)." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Context writes can fail for a read-only key (`insufficient_scope`), an editor-access shared account (`editor_restricted`; only the owner can edit Context), or an expired subscription. These writes do not use `writes_main_account_only`." }, "404": { "title": "No product with that id belongs to this account (`not_found`), or account_id is not one of your accounts (`account_not_found`)." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "addDatasetToContacts": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/datasets/{id}/contacts";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        setBodyField(body, { "name": "list_id", "displayName": "List id", "description": "A contact list you created, from `GET /v1/contact-lists`.", "type": "string", "required": true }, this.getNodeParameter("list_id", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "The dataset holds no people to add (`dataset_has_no_people`), a system list was targeted (`system_list_read_only`), or the body was malformed (`invalid_parameter`)." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "Either end of the copy is missing: `dataset_not_found` (no dataset\nwith that id belongs to this key, or it has expired) or\n`list_not_found` (no contact list with that id belongs to this\naccount). Read `error.code` to tell them apart." }, "409": { "title": "The dataset id is valid but the dataset is not `ready`. The error\ncarries the current `dataset_status`: `collecting` finishes on its own\n(poll `GET /v1/datasets/{id}`), `failed` has to be rebuilt in the\nSuperX app." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "createDataset": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/datasets";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["Idempotency-Key"] !== undefined)
                            headers["Idempotency-Key"] = additionalFields["Idempotency-Key"];
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "description": "Which of your accounts to collect as. Omit for the main account.", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        if (additionalFields["agent_id"] !== undefined)
                            setBodyField(body, { "name": "agent_id", "displayName": "Agent id", "description": "`research` only: research this signal agent's leads. Exactly one source field.", "type": "integer", "minValue": 1 }, additionalFields["agent_id"], this, itemIndex);
                        if (additionalFields["dataset_id"] !== undefined)
                            setBodyField(body, { "name": "dataset_id", "displayName": "Dataset id", "description": "`research` only: research the people in this dataset. Exactly one source field.", "type": "string" }, additionalFields["dataset_id"], this, itemIndex);
                        if (additionalFields["filters"] !== undefined)
                            setBodyField(body, { "name": "filters", "displayName": "Filters", "type": "object", "representation": "raw", "fields": [{ "name": "bio_keywords", "displayName": "Bio keywords", "description": "Keep only people whose X bio contains one of these. Ignored for own content.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "keywords", "displayName": "Keywords", "description": "Keep only rows whose reply, quote or (own content) post text\ncontains one of these. Not applied to reposters or list\nmembers, whose rows carry no text.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, { "name": "min_followers", "displayName": "Min followers", "description": "Keep only people with at least this many followers. Ignored for own content.", "type": "integer", "minValue": 0 }, { "name": "require_can_dm", "displayName": "Require can dm", "description": "Keep only people whose DMs look open. Ignored for own content.", "type": "boolean" }, { "name": "require_website", "displayName": "Require website", "description": "Keep only people with a website link in their profile. Ignored for own content.", "type": "boolean" }, { "name": "since_days", "displayName": "Since days", "description": "Own content only: keep posts from the last N days.", "type": "integer", "minValue": 1 }, { "name": "sort", "displayName": "Sort", "description": "Own content only: which posts to keep when max_rows cuts the list.", "type": "string", "enum": ["recent", "likes", "impressions"] }] }, additionalFields["filters"], this, itemIndex);
                        if (additionalFields["focus"] !== undefined)
                            setBodyField(body, { "name": "focus", "displayName": "Focus", "description": "`research` only: an optional steer, e.g. \"founders who might need audience-growth tooling\".", "type": "string" }, additionalFields["focus"], this, itemIndex);
                        if (additionalFields["handles"] !== undefined)
                            setBodyField(body, { "name": "handles", "displayName": "Handles", "description": "`research` only: research these X handles (with or without the @). Exactly one source field.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, additionalFields["handles"], this, itemIndex);
                        if (additionalFields["list_id"] !== undefined)
                            setBodyField(body, { "name": "list_id", "displayName": "List id", "description": "`research` only: research the members of this contact list. Exactly one source field.", "type": "string" }, additionalFields["list_id"], this, itemIndex);
                        if (additionalFields["max_rows"] !== undefined)
                            setBodyField(body, { "name": "max_rows", "displayName": "Max rows", "description": "Rows to collect at most. For `source: \"research\"` the range is\n1-25 and the default is 10 (one profile per row).", "type": "integer", "minValue": 1, "maxValue": 1000, "default": 500 }, additionalFields["max_rows"], this, itemIndex);
                        setBodyField(body, { "name": "source", "displayName": "Source", "description": "Post target for `repliers`/`quoters`/`reposters`; public X list for `list_members`; synced posts for `my_posts`/`my_replies`. For `research`, use `focus` and one of `handles`, `list_id`, `agent_id`, or `dataset_id`; it ignores `target`/`filters`.", "type": "string", "required": true, "enum": ["repliers", "quoters", "reposters", "list_members", "my_replies", "my_posts", "research"] }, this.getNodeParameter("source", itemIndex), this, itemIndex);
                        if (additionalFields["target"] !== undefined)
                            setBodyField(body, { "name": "target", "displayName": "Target", "description": "An x.com post URL or numeric post id, or for list_members an\nx.com list URL (/i/lists/<id>) or numeric list id. Omit for\nmy_posts and my_replies.", "type": "string" }, additionalFields["target"], this, itemIndex);
                        if (additionalFields["title"] !== undefined)
                            setBodyField(body, { "name": "title", "displayName": "Title", "description": "Title for the dataset. A sensible one is generated when omitted.", "type": "string" }, additionalFields["title"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "meta", "note"], simplified: ["data", "meta", "note"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "`account_not_found` when `account_id` is not one of your accounts.\nOn `source: \"research\"` the source id is named too:\n`list_not_found`, `agent_not_found`, or `not_found` for a dataset\nid that is unknown or expired." }, "409": { "title": "A collection is already running (`collection_in_progress`), the idempotency key was reused with a different body (`idempotency_key_reuse`), or the research dataset is not ready (`dataset_not_ready`, includes `dataset_status`). No new task started." }, "429": { "title": "429 codes: `collection_quota_exceeded`, `rate_limited`, `ai_action_limited` (scope `account`/`platform`), or `ai_credits_exhausted`. Honor `Retry-After`; action caps include `reset_at`. Rejected requests start nothing and are not charged." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "Linked-account verification is temporarily unavailable (fail closed). The main account keeps working." } };
                        break;
                    }
                    case "draftDatasetOutreach": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/datasets/{id}/outreach-drafts";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "description": "Which of your accounts to draft as. Omit for the main account.", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        setBodyField(body, { "name": "format", "displayName": "Format", "description": "The template or example message every draft should follow. Keep\n`[name]`, `[first]` and `[handle]` tokens if you want them filled\nin per recipient at send time.", "type": "string", "required": true }, this.getNodeParameter("format", itemIndex), this, itemIndex);
                        if (additionalFields["instructions"] !== undefined)
                            setBodyField(body, { "name": "instructions", "displayName": "Instructions", "description": "Optional extra steer: tone, what to emphasize, what to avoid.", "type": "string" }, additionalFields["instructions"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "meta", "note"], simplified: ["data", "meta", "note"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "No dataset with that id belongs to this key, or it has expired." }, "409": { "title": "The dataset id is valid but the dataset is not `ready`. The error\ncarries the current `dataset_status`: `collecting` finishes on its own\n(poll `GET /v1/datasets/{id}`), `failed` has to be rebuilt in the\nSuperX app." }, "429": { "title": "429 codes: `rate_limited`, `ai_credits_exhausted`, or `ai_action_limited`. The last uses `scope: account` for plan/feature caps and `platform` for shared live-data caps. Check `reset_at` and honor `Retry-After`; rejected actions are not charged." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "Linked-account verification is temporarily unavailable (fail closed). The main account keeps working." } };
                        break;
                    }
                    case "exportDataset": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/datasets/{id}/export";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["format"] !== undefined)
                            qs["format"] = additionalFields["format"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "No dataset with that id belongs to this key, or it has expired." }, "409": { "title": "The dataset id is valid but the dataset is not `ready`. The error\ncarries the current `dataset_status`: `collecting` finishes on its own\n(poll `GET /v1/datasets/{id}`), `failed` has to be rebuilt in the\nSuperX app." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." } };
                        break;
                    }
                    case "getDataset": {
                        let path = "/v1/datasets/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "No dataset with that id belongs to this key, or it has expired." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." } };
                        break;
                    }
                    case "getDatasetRows": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/datasets/{id}/rows";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "pagination"], simplified: ["data", "pagination"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "No dataset with that id belongs to this key, or it has expired." }, "409": { "title": "The dataset id is valid but the dataset is not `ready`. The error\ncarries the current `dataset_status`: `collecting` finishes on its own\n(poll `GET /v1/datasets/{id}`), `failed` has to be rebuilt in the\nSuperX app." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." } };
                        break;
                    }
                    case "listDatasets": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/datasets";
                        const qs = {};
                        const body = {};
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "pagination"], simplified: ["data", "pagination"] };
                        errorPlan = { "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." } };
                        break;
                    }
                    case "refineDataset": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/datasets/{id}/refine";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "description": "Which of your accounts to refine as. Omit for the main account.", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        setBodyField(body, { "name": "criterion", "displayName": "Criterion", "description": "What the rows to match look like, judged on each row's own text,\ne.g. \"supportive or neutral; not mean, sarcastic, or hostile\".", "type": "string", "required": true }, this.getNodeParameter("criterion", itemIndex), this, itemIndex);
                        if (additionalFields["keep_matching"] !== undefined)
                            setBodyField(body, { "name": "keep_matching", "displayName": "Keep matching", "description": "true keeps the rows that MATCH the criterion; false keeps the rows that do NOT.", "type": "boolean", "default": true }, additionalFields["keep_matching"], this, itemIndex);
                        if (additionalFields["limit"] !== undefined)
                            setBodyField(body, { "name": "limit", "displayName": "Limit", "description": "Keep at most this many rows after filtering and sorting.", "type": "integer", "minValue": 1, "maxValue": 1000 }, additionalFields["limit"], this, itemIndex);
                        if (additionalFields["sort_by"] !== undefined)
                            setBodyField(body, { "name": "sort_by", "displayName": "Sort by", "description": "Sort the kept rows descending before the limit is applied.", "type": "string", "enum": ["followers", "likes", "none"], "default": "none" }, additionalFields["sort_by"], this, itemIndex);
                        if (additionalFields["title"] !== undefined)
                            setBodyField(body, { "name": "title", "displayName": "Title", "description": "Title for the new dataset. A sensible one is generated when omitted.", "type": "string" }, additionalFields["title"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "meta", "note"], simplified: ["data", "meta", "note"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "No dataset with that id belongs to this key, or it has expired." }, "409": { "title": "The dataset is not ready (`dataset_not_ready`), or another collection/refinement is running (`collection_in_progress`). Nothing started; the latter does not use the daily collection quota." }, "429": { "title": "Daily collection quota (`collection_quota_exceeded`), exhausted AI credits (`ai_credits_exhausted`), or refinement cap (`ai_action_limited`). Read `error.code` and honor `Retry-After`." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "Linked-account verification is temporarily unavailable (fail closed). The main account keeps working." } };
                        break;
                    }
                    case "cancelDmCampaign": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/dm/campaigns/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "No DM campaign with that id belongs to this account, or it queued nothing in the first place, or every message it queued is gone." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "getDmCampaign": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/dm/campaigns/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "No DM campaign with that id belongs to this account, or it queued nothing in the first place, or every message it queued is gone." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "getDmLimits": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/dm/limits";
                        const qs = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "meta"], simplified: ["data", "meta"] };
                        errorPlan = { "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "account_id is not one of your accounts." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "listDmQueue": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/dm/queue";
                        const qs = {};
                        const body = {};
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["offset"] !== undefined)
                            qs["offset"] = additionalFields["offset"];
                        if (additionalFields["status"] !== undefined)
                            qs["status"] = additionalFields["status"];
                        if (additionalFields["campaign_id"] !== undefined)
                            qs["campaign_id"] = additionalFields["campaign_id"];
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "meta"], simplified: ["data", "meta"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "account_id is not one of your accounts." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "queueDmCampaign": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/dm/campaigns";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["Idempotency-Key"] !== undefined)
                            headers["Idempotency-Key"] = additionalFields["Idempotency-Key"];
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "description": "Any account you own, meaning your main account (the default when omitted) or one linked to it. An account shared with you returns `403 writes_main_account_only`.", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        if (additionalFields["message"] !== undefined)
                            setBodyField(body, { "name": "message", "displayName": "Message", "description": "The shared message. Required unless every recipient carries its own.", "type": "string" }, additionalFields["message"], this, itemIndex);
                        setBodyField(body, { "name": "recipients", "displayName": "Recipients", "type": "array", "required": true, "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "object", "representation": "raw", "fields": [{ "name": "handle", "displayName": "Handle", "description": "The recipient's @handle, used to fill `[handle]`.", "type": "string" }, { "name": "message", "displayName": "Message", "description": "This recipient's own message, instead of the shared one.", "type": "string" }, { "name": "name", "displayName": "Name", "description": "The recipient's display name, used to fill `[name]` and `[first]`.", "type": "string" }, { "name": "source_post_id", "displayName": "Source post id", "description": "The post this person was found on, so later imports of it can skip them.", "type": "string", "pattern": "^[0-9]{1,25}$" }, { "name": "x_user_id", "displayName": "X user id", "description": "The recipient's X user id (digits).", "type": "string", "required": true, "pattern": "^[0-9]{1,25}$" }] } }, this.getNodeParameter("recipients", itemIndex), this, itemIndex);
                        if (additionalFields["spread"] !== undefined)
                            setBodyField(body, { "name": "spread", "displayName": "Spread", "description": "Spread what today's daily allowance cannot hold over the coming days instead of skipping it. Ignored when `GET /v1/dm/limits` reports `scheduling_enabled: false`; the overflow is then counted in `skipped`.", "type": "boolean", "default": false }, additionalFields["spread"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "note"], simplified: ["data", "note"] };
                        errorPlan = { "400": { "title": "A parameter is invalid (`invalid_parameter`), or the account has no X account connected (`account_not_linked`)." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "The key is read-only (`insufficient_scope`), the account is shared with you (`writes_main_account_only`), the plan has no DM allowance (`dm_not_in_plan`), or the X account must be reconnected in the app (`reauth_required`)." }, "404": { "title": "account_id is not one of your accounts." }, "409": { "title": "The Idempotency-Key was already used with a different request body." }, "429": { "title": "The account's DM allowance is used up (`dm_limit_reached`). `scope` is `month` or `day`; the monthly refusal also carries `reset_at`. These are plan limits, not AI credits." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "createEngageFeed": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/engage/feeds";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "description": "Any account you own, meaning your main account (the default when omitted) or one linked to it. An account shared with you returns `403 writes_main_account_only`.", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        if (additionalFields["keywords"] !== undefined)
                            setBodyField(body, { "name": "keywords", "displayName": "Keywords", "description": "For type keywords. Trimmed, de-duplicated case-insensitively.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, additionalFields["keywords"], this, itemIndex);
                        if (additionalFields["list_id"] !== undefined)
                            setBodyField(body, { "name": "list_id", "displayName": "List id", "description": "For type list. A contact list id from `GET /v1/contact-lists`.", "type": "string" }, additionalFields["list_id"], this, itemIndex);
                        setBodyField(body, { "name": "name", "displayName": "Name", "description": "Feed name shown in SuperX.", "type": "string", "required": true }, this.getNodeParameter("name", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "type", "displayName": "Type", "description": "Must match the source fields sent below.", "type": "string", "required": true, "enum": ["keywords", "x_list", "list"] }, this.getNodeParameter("type", itemIndex), this, itemIndex);
                        if (additionalFields["x_list_id"] !== undefined)
                            setBodyField(body, { "name": "x_list_id", "displayName": "X list id", "description": "For type x_list. A numeric X list id. Use this OR x_list_url.", "type": "string" }, additionalFields["x_list_id"], this, itemIndex);
                        if (additionalFields["x_list_url"] !== undefined)
                            setBodyField(body, { "name": "x_list_url", "displayName": "X list url", "description": "For type x_list. A link like https://x.com/i/lists/1234567890.", "type": "string" }, additionalFields["x_list_url"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "The source is unavailable: the X list is private, deleted, or unknown (`x_list_not_found`); the contact list is unknown (`list_not_found`); the feed is unknown (`feed_not_found`, on update); or the account ID is invalid (`account_not_found`)." }, "409": { "title": "The account already holds the maximum number of saved Engage feeds (8)." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "deleteEngageFeed": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/engage/feeds/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "The feed id is not one of your Engage feeds (`feed_not_found`), the feed points at a contact list that no longer exists (`list_not_found`), or account_id is not one of your accounts (`account_not_found`)." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "draftEngageReply": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/engage/reply-draft";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        if (additionalFields["conversation"] !== undefined)
                            setBodyField(body, { "name": "conversation", "displayName": "Conversation", "description": "The thread so far, OLDEST FIRST, so the reply fits the conversation.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "description": "A post, supplied by you rather than read from X.", "type": "object", "representation": "raw", "fields": [{ "name": "author_handle", "displayName": "Author handle", "description": "The author's handle. A leading @ is accepted and stripped.", "type": "string" }, { "name": "author_name", "displayName": "Author name", "description": "The author's display name.", "type": "string" }, { "name": "text", "displayName": "Text", "type": "string", "required": true }] } }, additionalFields["conversation"], this, itemIndex);
                        if (additionalFields["post"] !== undefined)
                            setBodyField(body, { "name": "post", "displayName": "Post", "description": "A post, supplied by you rather than read from X.", "type": "object", "representation": "raw", "fields": [{ "name": "author_handle", "displayName": "Author handle", "description": "The author's handle. A leading @ is accepted and stripped.", "type": "string" }, { "name": "author_name", "displayName": "Author name", "description": "The author's display name.", "type": "string" }, { "name": "text", "displayName": "Text", "type": "string", "required": true }] }, additionalFields["post"], this, itemIndex);
                        if (additionalFields["post_id"] !== undefined)
                            setBodyField(body, { "name": "post_id", "displayName": "Post id", "description": "An X post id. The API reads the post live, which costs one live lookup on top of the credit.", "type": "string", "pattern": "^[0-9]{1,25}$" }, additionalFields["post_id"], this, itemIndex);
                        if (additionalFields["quoted_post"] !== undefined)
                            setBodyField(body, { "name": "quoted_post", "displayName": "Quoted post", "description": "The post that the post being replied to quotes. Filled in automatically when you pass post_id.", "type": "object", "representation": "raw", "fields": [{ "name": "author_handle", "displayName": "Author handle", "description": "The author's handle. A leading @ is accepted and stripped.", "type": "string" }, { "name": "author_name", "displayName": "Author name", "description": "The author's display name.", "type": "string" }, { "name": "text", "displayName": "Text", "type": "string", "required": true }] }, additionalFields["quoted_post"], this, itemIndex);
                        if (additionalFields["thoughts"] !== undefined)
                            setBodyField(body, { "name": "thoughts", "displayName": "Thoughts", "description": "What the person wants the reply to convey. Ask them; do not invent an opinion for them.", "type": "string" }, additionalFields["thoughts"], this, itemIndex);
                        if (additionalFields["tone"] !== undefined)
                            setBodyField(body, { "name": "tone", "displayName": "Tone", "type": "string", "enum": ["engaging", "humorous", "creative", "sarcastic", "inspirational", "concise"] }, additionalFields["tone"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "meta", "note"], simplified: ["data", "meta", "note"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "No public post with that id, or it is protected or deleted." }, "422": { "title": "The post was read but carries no text to reply to. Supply the text yourself with `post`." }, "429": { "title": "429 codes: `rate_limited`, `ai_credits_exhausted`, or `ai_action_limited`. The last uses `scope: account` for plan/feature caps and `platform` for shared live-data caps. Check `reset_at` and honor `Retry-After`; rejected actions are not charged." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "Linked-account verification is temporarily unavailable (fail closed). The main account keeps working." } };
                        break;
                    }
                    case "getEngageFeedPosts": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/engage/feeds/{id}/posts";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["mode"] !== undefined)
                            qs["mode"] = additionalFields["mode"];
                        if (additionalFields["fresh"] !== undefined)
                            qs["fresh"] = additionalFields["fresh"];
                        if (additionalFields["include_replied"] !== undefined)
                            qs["include_replied"] = additionalFields["include_replied"];
                        if (additionalFields["exclude_post_ids"] !== undefined)
                            qs["exclude_post_ids"] = additionalFields["exclude_post_ids"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "feed", "has_more"], simplified: ["data", "feed", "has_more"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "The feed id is not one of your Engage feeds (`feed_not_found`), the feed points at a contact list that no longer exists (`list_not_found`), or account_id is not one of your accounts (`account_not_found`)." }, "429": { "title": "The feed allowance is exhausted or feed fetches are temporarily busy. Honor `Retry-After`. Rejected requests use no feed units but consume one ordinary read; `X-RateLimit-*` headers describe that read bucket." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "getMentions": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/engage/mentions";
                        const qs = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        if (additionalFields["cursor"] !== undefined)
                            qs["cursor"] = additionalFields["cursor"];
                        if (additionalFields["sort"] !== undefined)
                            qs["sort"] = additionalFields["sort"];
                        if (additionalFields["include_replied"] !== undefined)
                            qs["include_replied"] = additionalFields["include_replied"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "pagination"], simplified: ["data", "pagination"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "account_id is not one of your accounts." }, "409": { "title": "The account's X profile has not synced into SuperX yet, so there is\nno handle to search mentions for. Open the account in the SuperX app\nonce and retry." }, "429": { "title": "The feed allowance is exhausted or feed fetches are temporarily busy. Honor `Retry-After`. Rejected requests use no feed units but consume one ordinary read; `X-RateLimit-*` headers describe that read bucket." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "listEngageFeeds": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/engage/feeds";
                        const qs = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "updateEngageFeed": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/engage/feeds/{id}";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "description": "Any account you own, meaning your main account (the default when omitted) or one linked to it. An account shared with you returns `403 writes_main_account_only`.", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        if (additionalFields["keywords"] !== undefined)
                            setBodyField(body, { "name": "keywords", "displayName": "Keywords", "description": "Replace the feed's keywords (makes it a keyword feed).", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, additionalFields["keywords"], this, itemIndex);
                        if (additionalFields["list_id"] !== undefined)
                            setBodyField(body, { "name": "list_id", "displayName": "List id", "description": "Point the feed at this contact list.", "type": "string" }, additionalFields["list_id"], this, itemIndex);
                        if (additionalFields["name"] !== undefined)
                            setBodyField(body, { "name": "name", "displayName": "Name", "type": "string" }, additionalFields["name"], this, itemIndex);
                        if (additionalFields["x_list_id"] !== undefined)
                            setBodyField(body, { "name": "x_list_id", "displayName": "X list id", "description": "Point the feed at this numeric X list id. Use this OR x_list_url.", "type": "string" }, additionalFields["x_list_id"], this, itemIndex);
                        if (additionalFields["x_list_url"] !== undefined)
                            setBodyField(body, { "name": "x_list_url", "displayName": "X list url", "description": "Point the feed at this X list link.", "type": "string" }, additionalFields["x_list_url"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "PATCH", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "The source is unavailable: the X list is private, deleted, or unknown (`x_list_not_found`); the contact list is unknown (`list_not_found`); the feed is unknown (`feed_not_found`, on update); or the account ID is invalid (`account_not_found`)." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "getMe": {
                        const path = "/v1/me";
                        const qs = {};
                        const body = {};
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." } };
                        break;
                    }
                    case "listAccounts": {
                        const path = "/v1/accounts";
                        const qs = {};
                        const body = {};
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "degraded", "pagination"], simplified: ["data", "degraded", "pagination"] };
                        errorPlan = { "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "503": { "title": "Linked-account verification is temporarily unavailable (fail closed). The main account keeps working." } };
                        break;
                    }
                    case "searchInspiration": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/inspiration";
                        const qs = {};
                        const body = {};
                        qs["q"] = this.getNodeParameter("q", itemIndex);
                        if (additionalFields["sort"] !== undefined)
                            qs["sort"] = additionalFields["sort"];
                        if (additionalFields["min_likes"] !== undefined)
                            qs["min_likes"] = additionalFields["min_likes"];
                        if (additionalFields["min_reposts"] !== undefined)
                            qs["min_reposts"] = additionalFields["min_reposts"];
                        if (additionalFields["min_replies"] !== undefined)
                            qs["min_replies"] = additionalFields["min_replies"];
                        if (additionalFields["min_bookmarks"] !== undefined)
                            qs["min_bookmarks"] = additionalFields["min_bookmarks"];
                        if (additionalFields["min_impressions"] !== undefined)
                            qs["min_impressions"] = additionalFields["min_impressions"];
                        if (additionalFields["min_length"] !== undefined)
                            qs["min_length"] = additionalFields["min_length"];
                        if (additionalFields["min_followers"] !== undefined)
                            qs["min_followers"] = additionalFields["min_followers"];
                        if (additionalFields["max_followers"] !== undefined)
                            qs["max_followers"] = additionalFields["max_followers"];
                        if (additionalFields["since"] !== undefined)
                            qs["since"] = additionalFields["since"];
                        if (additionalFields["until"] !== undefined)
                            qs["until"] = additionalFields["until"];
                        if (additionalFields["lang"] !== undefined)
                            qs["lang"] = additionalFields["lang"];
                        if (additionalFields["exclude_topics"] !== undefined)
                            qs["exclude_topics"] = additionalFields["exclude_topics"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "pagination"], simplified: ["data", "pagination"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "503": { "title": "Linked-account verification is temporarily unavailable (fail closed). The main account keeps working." } };
                        break;
                    }
                    case "searchInspirationMedia": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/inspiration/media";
                        const qs = {};
                        const body = {};
                        if (additionalFields["q"] !== undefined)
                            qs["q"] = additionalFields["q"];
                        if (additionalFields["platforms"] !== undefined)
                            qs["platforms"] = additionalFields["platforms"];
                        if (additionalFields["time_filter"] !== undefined)
                            qs["time_filter"] = additionalFields["time_filter"];
                        if (additionalFields["media_type"] !== undefined)
                            qs["media_type"] = additionalFields["media_type"];
                        if (additionalFields["content_type"] !== undefined)
                            qs["content_type"] = additionalFields["content_type"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "meta"], simplified: ["data", "meta"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "createMediaUpload": {
                        const path = "/v1/media";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        setBodyField(body, { "name": "file_type", "displayName": "File type", "type": "string", "required": true, "enum": ["image/jpeg", "image/png", "image/webp", "image/gif"] }, this.getNodeParameter("file_type", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "filename", "displayName": "Filename", "description": "Original filename; sanitized into the object key.", "type": "string", "required": true }, this.getNodeParameter("filename", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "size", "displayName": "Size", "description": "File size in bytes. 5 MB max (15 MB for GIF).", "type": "integer", "required": true }, this.getNodeParameter("size", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "Invalid parameter, unsupported type (`unsupported_media_type`; videos land here), or over the size cap (`media_too_large`)." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`) or a lapsed subscription (legacy string envelope)." }, "429": { "title": "Write rate limit (`rate_limited`) or the daily media quota (`media_quota_exceeded`, 100/day). `Retry-After` indicates the wait." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "503": { "title": "Media storage is not configured (`media_not_configured`) or temporarily unavailable (`upstream_unavailable`)." } };
                        break;
                    }
                    case "getDocs": {
                        const path = "/v1/docs";
                        const qs = {};
                        const body = {};
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = {};
                        break;
                    }
                    case "getQueueSettings": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/queue-settings";
                        const qs = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "updateQueueSettings": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/queue-settings";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        if (additionalFields["account_idBody"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_idBody"], this, itemIndex);
                        if (additionalFields["slots"] !== undefined)
                            setBodyField(body, { "name": "slots", "displayName": "Slots", "description": "Full replace of the predefined posting slots. `[]` clears them all.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "object", "representation": "raw", "fields": [{ "name": "days", "displayName": "Days", "description": "Weekdays this slot runs on, 0 = Sunday. Sorted ascending on read; duplicates are deduped on write.", "type": "array", "required": true, "example": [1, 3, 5], "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "integer", "minValue": 0, "maxValue": 6 } }, { "name": "time", "displayName": "Time", "description": "24-hour local time in the account's queue timezone, `HH:MM`.", "type": "string", "required": true, "example": "09:00", "pattern": "^([01][0-9]|2[0-3]):[0-5][0-9]$" }] } }, additionalFields["slots"], this, itemIndex);
                        if (additionalFields["timezone"] !== undefined)
                            setBodyField(body, { "name": "timezone", "displayName": "Timezone", "description": "IANA timezone name the slot times run in, for example `Europe/London`.", "type": "string" }, additionalFields["timezone"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "PATCH", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "note", "reflow"], simplified: ["data", "note", "reflow"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Queue writes can fail for a read-only key (`insufficient_scope`) or an expired subscription. Linked and shared accounts, including editor-access shares, can edit queue settings; `writes_main_account_only` and `editor_restricted` do not apply." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "bulkDeleteScheduledPosts": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/scheduled-posts/bulk/delete";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "description": "Any account you own. An account shared with you returns `403 writes_main_account_only`.", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        setBodyField(body, { "name": "ids", "displayName": "Ids", "description": "Post ids (from `GET /v1/scheduled-posts`). Repeated ids are deduplicated.", "type": "array", "required": true, "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, this.getNodeParameter("ids", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "bulkEnableAutoRetweet": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/scheduled-posts/bulk/auto-retweet";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "description": "Any account you own. An account shared with you returns `403 writes_main_account_only`.", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        setBodyField(body, { "name": "auto_retweet", "displayName": "Auto retweet", "description": "The auto retweet to apply to every listed post.", "type": "object", "required": true, "representation": "raw", "fields": [{ "name": "after_hours", "displayName": "After hours", "description": "Retweet each post this many hours after it goes live.", "type": "integer", "required": true, "minValue": 1, "maxValue": 12 }, { "name": "remove_after_hours", "displayName": "Remove after hours", "description": "Remove the retweet this many hours later. Omit to keep it.", "type": "integer", "minValue": 1, "maxValue": 12 }] }, this.getNodeParameter("auto_retweet", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "ids", "displayName": "Ids", "description": "Post ids (from `GET /v1/scheduled-posts`). Repeated ids are deduplicated.", "type": "array", "required": true, "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, this.getNodeParameter("ids", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "bulkRetimeScheduledPosts": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/scheduled-posts/bulk/retime";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "description": "Any account you own. An account shared with you returns `403 writes_main_account_only`.", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        setBodyField(body, { "name": "moves", "displayName": "Moves", "description": "The moves to apply. Post ids must be unique within one call.", "type": "array", "required": true, "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "object", "representation": "raw", "fields": [{ "name": "id", "displayName": "Id", "description": "Post id (from `GET /v1/scheduled-posts`).", "type": "string", "required": true }, { "name": "scheduled_for", "displayName": "Scheduled for", "description": "New time, UTC ISO-8601 with explicit Z or offset.", "type": "string", "format": "date-time", "required": true }] } }, this.getNodeParameter("moves", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "createScheduledPost": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/scheduled-posts";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["Idempotency-Key"] !== undefined)
                            headers["Idempotency-Key"] = additionalFields["Idempotency-Key"];
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "description": "Any account you own, meaning your main account (the default when omitted) or one linked to it. An account shared with you returns `403 writes_main_account_only`.", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        if (additionalFields["auto_delete"] !== undefined)
                            setBodyField(body, { "name": "auto_delete", "displayName": "Auto delete", "description": "Auto delete underperforming posts. Omit to inherit your defaults; `null` turns it off for this post.", "type": "object", "representation": "raw", "nullable": true, "fields": [{ "name": "after_hours", "displayName": "After hours", "description": "Delete the post this many hours after it goes live if it is under the views threshold.", "type": "integer", "required": true, "minValue": 1, "maxValue": 12 }, { "name": "threshold", "displayName": "Threshold", "description": "Views threshold (default 1000).", "type": "integer", "minValue": 0 }] }, additionalFields["auto_delete"], this, itemIndex);
                        if (additionalFields["auto_dm"] !== undefined)
                            setBodyField(body, { "name": "auto_dm", "displayName": "Auto dm", "description": "Auto DM: message the people who reply to or repost this post once it is live. Omit to inherit your defaults; `null` turns it off for this post.", "type": "object", "representation": "raw", "nullable": true, "fields": [{ "name": "batch_mode", "displayName": "Batch mode", "description": "Send the DMs in one batch rather than as engagement arrives.", "type": "boolean" }, { "name": "enabled", "displayName": "Enabled", "description": "`false` behaves exactly like sending `auto_dm: null`: the Auto DM is cleared and nothing is stored. Prefer `null`.", "type": "boolean", "default": true }, { "name": "max_dms", "displayName": "Max dms", "description": "Most people to DM for this post. The plan's per-post cap still applies.", "type": "integer", "minValue": 1, "maxValue": 100, "default": 100 }, { "name": "message", "displayName": "Message", "description": "The direct message. `[name]`, `[first]` and `[handle]` are filled in per recipient. Always required on a non-null `auto_dm`.", "type": "string", "required": true }, { "name": "triggers", "displayName": "Triggers", "description": "Who gets the DM. At least one must be true; defaults to reply only. Any other key is rejected with `400 invalid_parameter`.", "type": "object", "representation": "raw", "fields": [{ "name": "reply", "displayName": "Reply", "description": "DM the people who reply to the post.", "type": "boolean" }, { "name": "repost", "displayName": "Repost", "description": "DM the people who repost the post.", "type": "boolean" }, { "name": "retweet", "displayName": "Retweet", "description": "Alias of `repost`, accepted so the value a post reads back (which reports `retweet`) can be sent straight back. Sending both with different values is a `400`.", "type": "boolean" }] }] }, additionalFields["auto_dm"], this, itemIndex);
                        if (additionalFields["auto_plug"] !== undefined)
                            setBodyField(body, { "name": "auto_plug", "displayName": "Auto plug", "description": "Auto plug: reply with a template once the post hits a likes threshold. Omit to inherit your defaults; `null` turns it off for this post. Unknown template ids fail with `400 unknown_plug_template`.", "type": "object", "representation": "raw", "nullable": true, "fields": [{ "name": "template_id", "displayName": "Template id", "description": "Plug template id (from `GET /v1/plug-templates`).", "type": "string", "required": true }, { "name": "threshold", "displayName": "Threshold", "description": "Likes threshold that triggers the plug reply.", "type": "integer", "required": true, "minValue": 1 }] }, additionalFields["auto_plug"], this, itemIndex);
                        if (additionalFields["auto_retweet"] !== undefined)
                            setBodyField(body, { "name": "auto_retweet", "displayName": "Auto retweet", "description": "Auto retweet. Omit to inherit your Default Post Settings; `null` turns it off for this post.", "type": "object", "representation": "raw", "nullable": true, "fields": [{ "name": "after_hours", "displayName": "After hours", "description": "Retweet the post this many hours after it goes live.", "type": "integer", "required": true, "minValue": 1, "maxValue": 12 }, { "name": "remove_after_hours", "displayName": "Remove after hours", "description": "Remove the retweet this many hours later. Omit to keep it.", "type": "integer", "minValue": 1, "maxValue": 12 }] }, additionalFields["auto_retweet"], this, itemIndex);
                        if (additionalFields["parts"] !== undefined)
                            setBodyField(body, { "name": "parts", "displayName": "Parts", "description": "Thread parts, 1 to 25 items. Total text across parts is limited to 25,000 characters.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "object", "representation": "raw", "fields": [{ "name": "media", "displayName": "Media", "description": "Images for this part (up to 4, or exactly 1 GIF). `object_key` from `POST /v1/media`.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "object", "representation": "raw", "fields": [{ "name": "alt_text", "displayName": "Alt text", "description": "Accessibility description delivered to X with the image.", "type": "string" }, { "name": "object_key", "displayName": "Object key", "type": "string", "required": true }] } }, { "name": "text", "displayName": "Text", "type": "string", "required": true }] } }, additionalFields["parts"], this, itemIndex);
                        if (additionalFields["scheduled_for"] !== undefined)
                            setBodyField(body, { "name": "scheduled_for", "displayName": "Scheduled for", "description": "UTC ISO-8601 with explicit Z or offset: at least 60 seconds in the future, at most 18 months out. Omit to create a draft. The literal string `\"now\"` publishes to X immediately and requires an `Idempotency-Key` (see the operation description).", "type": "alternative", "format": "date-time", "composition": "oneOf", "representation": "raw", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "type": "string", "format": "date-time" }, { "name": "alternative2", "displayName": "Alternative2", "type": "string", "enum": ["now"] }] }, additionalFields["scheduled_for"], this, itemIndex);
                        if (additionalFields["scratchpad"] !== undefined)
                            setBodyField(body, { "name": "scratchpad", "displayName": "Scratchpad", "description": "Private working notes attached to the post. Never posted.", "type": "string" }, additionalFields["scratchpad"], this, itemIndex);
                        if (additionalFields["super_followers_only"] !== undefined)
                            setBodyField(body, { "name": "super_followers_only", "displayName": "Super followers only", "description": "Post to Super Followers only. Omit to inherit your defaults.", "type": "boolean" }, additionalFields["super_followers_only"], this, itemIndex);
                        if (additionalFields["tags"] !== undefined)
                            setBodyField(body, { "name": "tags", "displayName": "Tags", "description": "Tag ids to assign (from `GET /v1/tags`). Unknown ids fail the whole request with `400 unknown_tag` before anything is created.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, additionalFields["tags"], this, itemIndex);
                        if (additionalFields["text"] !== undefined)
                            setBodyField(body, { "name": "text", "displayName": "Text", "description": "The post text (single post). Provide either `text` or `parts`.", "type": "string" }, additionalFields["text"], this, itemIndex);
                        if (additionalFields["title"] !== undefined)
                            setBodyField(body, { "name": "title", "displayName": "Title", "description": "Draft title shown in the SuperX app. Organizational only, never posted.", "type": "string" }, additionalFields["title"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "Invalid request or parameter, unknown tag/template ID, or invalid media (`invalid_media`, `media_not_uploaded`, `unsupported_media_type`, `media_too_large`)." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), shared-account write (`writes_main_account_only`), incomplete onboarding (`onboarding_required`), exhausted quota (`post_quota_exceeded`), X reauthorization (`reauth_required`), or expired subscription." }, "404": { "title": "account_id is not one of your accounts." }, "409": { "title": "The idempotency key was reused with a different body (`idempotency_key_reuse`), the same publish is in progress (`idempotency_in_flight`; honor `Retry-After` and retry with the same key), or the post is already published (`post_already_published`)." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "deleteScheduledPost": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/scheduled-posts/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "No scheduled post with that id belongs to this account." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "draftPost": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/posts/draft";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "description": "Any account you own, meaning your main account (the default when omitted) or one linked to it. With `voice: mine` the drafts use this account's own posts and style guide. An account shared with you returns `403 writes_main_account_only`.", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        setBodyField(body, { "name": "brief", "displayName": "Brief", "description": "What the post should say: the data, angle, or notes to write from.", "type": "string", "required": true }, this.getNodeParameter("brief", itemIndex), this, itemIndex);
                        if (additionalFields["collection"] !== undefined)
                            setBodyField(body, { "name": "collection", "displayName": "Collection", "description": "Optional collection ID to guide draft shape (for example, `numbered_list`). Used only when `mirror` is omitted. Unknown or unusable IDs return `400 invalid_collection` with valid IDs.", "type": "string" }, additionalFields["collection"], this, itemIndex);
                        if (additionalFields["count"] !== undefined)
                            setBodyField(body, { "name": "count", "displayName": "Count", "description": "How many drafts to write. Each one costs credits.", "type": "integer", "minValue": 1, "maxValue": 3, "default": 1 }, additionalFields["count"], this, itemIndex);
                        if (additionalFields["creator"] !== undefined)
                            setBodyField(body, { "name": "creator", "displayName": "Creator", "description": "X handle to borrow style from, for example `@naval`. Required when `voice` is `creator` or `hybrid`, rejected when `voice` is `mine`.", "type": "string" }, additionalFields["creator"], this, itemIndex);
                        if (additionalFields["instructions"] !== undefined)
                            setBodyField(body, { "name": "instructions", "displayName": "Instructions", "description": "Extra style instructions for this batch.", "type": "string" }, additionalFields["instructions"], this, itemIndex);
                        if (additionalFields["mirror"] !== undefined)
                            setBodyField(body, { "name": "mirror", "displayName": "Mirror", "description": "Plain text of a proven post whose shape to copy. Only the form is reused, never the content. Pick a mirror with room for your data: a two-line aphorism squeezes the facts out. Omit to have a shape picked for you.", "type": "string" }, additionalFields["mirror"], this, itemIndex);
                        if (additionalFields["voice"] !== undefined)
                            setBodyField(body, { "name": "voice", "displayName": "Voice", "description": "Whose voice to write in. `mine` is the voice of the account in `account_id`: its own posts, style guide and rules. Omit `account_id` and that is your main account.", "type": "string", "enum": ["mine", "creator", "hybrid"], "default": "mine" }, additionalFields["voice"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "Invalid or missing input (`invalid_parameter`), unusable `mirror` (`mirror_rejected`), invalid `collection` (`invalid_collection`), unknown `creator` (`unknown_creator`), or unavailable creator style (`creator_style_unavailable`; do not retry)." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "account_id is not one of your accounts." }, "409": { "title": "The creator's style guide is being prepared (`creator_style_pending`). It is ready in about a minute; retry the same request." }, "429": { "title": "Rate limit (`rate_limited`), exhausted AI credits (`ai_credits_exhausted`), or a daily draft cap (`ai_action_limited`). Honor `Retry-After` when present." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "Every draft failed to generate (`generation_failed`). All credits for the call were refunded." } };
                        break;
                    }
                    case "listPlugTemplates": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/plug-templates";
                        const qs = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "listScheduledPosts": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/scheduled-posts";
                        const qs = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        if (additionalFields["status"] !== undefined)
                            qs["status"] = additionalFields["status"];
                        if (additionalFields["tags"] !== undefined)
                            qs["tags"] = additionalFields["tags"];
                        if (additionalFields["from"] !== undefined)
                            qs["from"] = additionalFields["from"];
                        if (additionalFields["to"] !== undefined)
                            qs["to"] = additionalFields["to"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "pagination"], simplified: ["data", "pagination"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "remixPost": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/posts/remix";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        setBodyField(body, { "name": "closeness", "displayName": "Closeness", "description": "0 keeps only the idea, 100 stays very close to the original wording.", "type": "integer", "required": true, "minValue": 0, "maxValue": 100 }, this.getNodeParameter("closeness", itemIndex), this, itemIndex);
                        if (additionalFields["instructions"] !== undefined)
                            setBodyField(body, { "name": "instructions", "displayName": "Instructions", "description": "Extra direction for this remix.", "type": "string" }, additionalFields["instructions"], this, itemIndex);
                        setBodyField(body, { "name": "text", "displayName": "Text", "description": "The post to remix.", "type": "string", "required": true }, this.getNodeParameter("text", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "meta"], simplified: ["data", "meta"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "429": { "title": "429 codes: `rate_limited`, `ai_credits_exhausted`, or `ai_action_limited`. The last uses `scope: account` for plan/feature caps and `platform` for shared live-data caps. Check `reset_at` and honor `Retry-After`; rejected actions are not charged." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "Linked-account verification is temporarily unavailable (fail closed). The main account keeps working." } };
                        break;
                    }
                    case "updateScheduledPost": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/scheduled-posts/{id}";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "description": "Any account you own, meaning your main account (the default when omitted) or one linked to it. An account shared with you returns `403 writes_main_account_only`.", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        if (additionalFields["auto_delete"] !== undefined)
                            setBodyField(body, { "name": "auto_delete", "displayName": "Auto delete", "description": "Auto delete override; `null` removes it. Omit to keep the current setting.", "type": "object", "representation": "raw", "nullable": true, "fields": [{ "name": "after_hours", "displayName": "After hours", "type": "integer", "required": true, "minValue": 1, "maxValue": 12 }, { "name": "threshold", "displayName": "Threshold", "description": "Views threshold (default 1000).", "type": "integer", "minValue": 0 }] }, additionalFields["auto_delete"], this, itemIndex);
                        if (additionalFields["auto_dm"] !== undefined)
                            setBodyField(body, { "name": "auto_dm", "displayName": "Auto dm", "description": "Auto DM override; `null` removes it and gives back the month's slot. Omit to keep the current setting. When a plan limit stops a new one from attaching, the edit still lands and the response carries `auto_dm_skipped: true`.", "type": "object", "representation": "raw", "nullable": true, "fields": [{ "name": "batch_mode", "displayName": "Batch mode", "description": "Send the DMs in one batch rather than as engagement arrives.", "type": "boolean" }, { "name": "enabled", "displayName": "Enabled", "description": "`false` behaves exactly like sending `auto_dm: null`: the Auto DM is cleared and nothing is stored. Prefer `null`.", "type": "boolean", "default": true }, { "name": "max_dms", "displayName": "Max dms", "description": "Most people to DM for this post. The plan's per-post cap still applies.", "type": "integer", "minValue": 1, "maxValue": 100, "default": 100 }, { "name": "message", "displayName": "Message", "description": "The direct message. `[name]`, `[first]` and `[handle]` are filled in per recipient. Always required on a non-null `auto_dm`.", "type": "string", "required": true }, { "name": "triggers", "displayName": "Triggers", "description": "Who gets the DM. At least one must be true; defaults to reply only. Any other key is rejected with `400 invalid_parameter`.", "type": "object", "representation": "raw", "fields": [{ "name": "reply", "displayName": "Reply", "description": "DM the people who reply to the post.", "type": "boolean" }, { "name": "repost", "displayName": "Repost", "description": "DM the people who repost the post.", "type": "boolean" }, { "name": "retweet", "displayName": "Retweet", "description": "Alias of `repost`, accepted so the value a post reads back (which reports `retweet`) can be sent straight back. Sending both with different values is a `400`.", "type": "boolean" }] }] }, additionalFields["auto_dm"], this, itemIndex);
                        if (additionalFields["auto_plug"] !== undefined)
                            setBodyField(body, { "name": "auto_plug", "displayName": "Auto plug", "description": "Auto plug override; `null` removes it. Omit to keep the current setting. Unknown template ids fail with `400 unknown_plug_template`.", "type": "object", "representation": "raw", "nullable": true, "fields": [{ "name": "template_id", "displayName": "Template id", "description": "Plug template id (from `GET /v1/plug-templates`).", "type": "string", "required": true }, { "name": "threshold", "displayName": "Threshold", "type": "integer", "required": true, "minValue": 1 }] }, additionalFields["auto_plug"], this, itemIndex);
                        if (additionalFields["auto_retweet"] !== undefined)
                            setBodyField(body, { "name": "auto_retweet", "displayName": "Auto retweet", "description": "Auto retweet override; `null` removes it. Omit to keep the current setting.", "type": "object", "representation": "raw", "nullable": true, "fields": [{ "name": "after_hours", "displayName": "After hours", "type": "integer", "required": true, "minValue": 1, "maxValue": 12 }, { "name": "remove_after_hours", "displayName": "Remove after hours", "type": "integer", "minValue": 1, "maxValue": 12 }] }, additionalFields["auto_retweet"], this, itemIndex);
                        if (additionalFields["parts"] !== undefined)
                            setBodyField(body, { "name": "parts", "displayName": "Parts", "description": "Replacement parts (full replace, media included), 1 to 25 items, 25,000 characters total. A part without `media` drops the media it carried.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "object", "representation": "raw", "fields": [{ "name": "media", "displayName": "Media", "description": "Images for this part (up to 4, or exactly 1 GIF). Re-list existing `object_key`s to keep them; new ones come from `POST /v1/media`.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "object", "representation": "raw", "fields": [{ "name": "alt_text", "displayName": "Alt text", "type": "string" }, { "name": "object_key", "displayName": "Object key", "type": "string", "required": true }] } }, { "name": "text", "displayName": "Text", "type": "string", "required": true }] } }, additionalFields["parts"], this, itemIndex);
                        if (additionalFields["scheduled_for"] !== undefined)
                            setBodyField(body, { "name": "scheduled_for", "displayName": "Scheduled for", "description": "New time, UTC ISO-8601 with explicit Z or offset. On its own it never promotes a draft.", "type": "string", "format": "date-time" }, additionalFields["scheduled_for"], this, itemIndex);
                        if (additionalFields["scratchpad"] !== undefined)
                            setBodyField(body, { "name": "scratchpad", "displayName": "Scratchpad", "description": "New notes; `null` clears them.", "type": "string", "nullable": true }, additionalFields["scratchpad"], this, itemIndex);
                        if (additionalFields["status"] !== undefined)
                            setBodyField(body, { "name": "status", "displayName": "Status", "description": "Explicit transition. `scheduled` requires a future time (via `scheduled_for` or already stored).", "type": "string", "enum": ["draft", "scheduled"] }, additionalFields["status"], this, itemIndex);
                        if (additionalFields["super_followers_only"] !== undefined)
                            setBodyField(body, { "name": "super_followers_only", "displayName": "Super followers only", "description": "Post to Super Followers only. Omit to keep the current setting.", "type": "boolean" }, additionalFields["super_followers_only"], this, itemIndex);
                        if (additionalFields["tags"] !== undefined)
                            setBodyField(body, { "name": "tags", "displayName": "Tags", "description": "Full replacement tag id set. `[]` clears all tags. Unknown ids fail with `400 unknown_tag`.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, additionalFields["tags"], this, itemIndex);
                        if (additionalFields["text"] !== undefined)
                            setBodyField(body, { "name": "text", "displayName": "Text", "description": "Replacement text (single post). Provide either `text` or `parts`, not both.", "type": "string" }, additionalFields["text"], this, itemIndex);
                        if (additionalFields["title"] !== undefined)
                            setBodyField(body, { "name": "title", "displayName": "Title", "description": "New title; `null` clears it.", "type": "string", "nullable": true }, additionalFields["title"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "PATCH", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "Invalid parameter, unknown tag/template ID, missing future time for `status: scheduled`, or invalid media (`invalid_media`, `media_not_uploaded`, `unsupported_media_type`, `media_too_large`)." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "No scheduled post with that id belongs to this account." }, "409": { "title": "The post is not editable (already sent or errored)." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "addSignalAgentSignal": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/signals/agents/{id}/signals";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "description": "Any account you own, meaning your main account (the default when omitted) or one linked to it. An account shared with you returns `403 writes_main_account_only`.", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        if (additionalFields["handle"] !== undefined)
                            setBodyField(body, { "name": "handle", "displayName": "Handle", "description": "profile_watch and follower_watch only. An X username, with or without a leading @.", "type": "string" }, additionalFields["handle"], this, itemIndex);
                        if (additionalFields["list"] !== undefined)
                            setBodyField(body, { "name": "list", "displayName": "List", "description": "list_watch only. A public X list id, or a link like https://x.com/i/lists/1234567890.", "type": "string" }, additionalFields["list"], this, itemIndex);
                        if (additionalFields["query"] !== undefined)
                            setBodyField(body, { "name": "query", "displayName": "Query", "description": "keyword_watch only. A plain-language description of what the target customer posts about, or an X search. Operators pass through; engagement filters such as min_faves are rejected.", "type": "string" }, additionalFields["query"], this, itemIndex);
                        setBodyField(body, { "name": "type", "displayName": "Type", "type": "string", "required": true, "enum": ["keyword_watch", "profile_watch", "follower_watch", "list_watch"] }, this.getNodeParameter("type", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`), a lapsed subscription, or the agent's per-plan signal limit is reached (`cap_reached`)." }, "404": { "title": "The agent id is not one of your signal agents (`agent_not_found`), the handle did not match an X account (`user_not_found`), or the X list is private or unavailable (`x_list_not_found`)." }, "409": { "title": "The agent already watches that target. An agent may hold each target once." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "createSignalAgent": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/signals/agents";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["Idempotency-Key"] !== undefined)
                            headers["Idempotency-Key"] = additionalFields["Idempotency-Key"];
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "description": "Any account you own, meaning your main account (the default when omitted) or one linked to it. An account shared with you returns `403 writes_main_account_only`.", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        if (additionalFields["destination_list_id"] !== undefined)
                            setBodyField(body, { "name": "destination_list_id", "displayName": "Destination list id", "description": "Contact list id (from `GET /v1/contact-lists`) that receives the leads. Omit to auto-create one.", "type": "string" }, additionalFields["destination_list_id"], this, itemIndex);
                        setBodyField(body, { "name": "icp_description", "displayName": "Icp description", "description": "Who the ideal leads are; found people are scored against this.", "type": "string", "required": true }, this.getNodeParameter("icp_description", itemIndex), this, itemIndex);
                        if (additionalFields["keywords"] !== undefined)
                            setBodyField(body, { "name": "keywords", "displayName": "Keywords", "description": "Plain-language descriptions of what the target customer posts about. Omit to auto-suggest from the ICP. Keywords beyond your plan's per-agent signal limit are dropped; the response lists the signals actually created.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, additionalFields["keywords"], this, itemIndex);
                        setBodyField(body, { "name": "name", "displayName": "Name", "description": "Agent name shown in SuperX.", "type": "string", "required": true }, this.getNodeParameter("name", itemIndex), this, itemIndex);
                        if (additionalFields["precision_mode"] !== undefined)
                            setBodyField(body, { "name": "precision_mode", "displayName": "Precision mode", "description": "high = fewer, stricter matches; discovery = broader net.", "type": "string", "enum": ["high", "discovery"], "default": "high" }, additionalFields["precision_mode"], this, itemIndex);
                        if (additionalFields["signals"] !== undefined)
                            setBodyField(body, { "name": "signals", "displayName": "Signals", "description": "Non-keyword watches to add alongside `keywords`. Combined with `keywords`, at most 5 distinct entries.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "description": "One thing for a signal agent to watch. The target field depends on `type`: `query` for keyword_watch, `handle` for profile_watch and follower_watch, `list` for list_watch.", "type": "object", "representation": "raw", "fields": [{ "name": "handle", "displayName": "Handle", "description": "profile_watch and follower_watch only. An X username, with or without a leading @.", "type": "string" }, { "name": "list", "displayName": "List", "description": "list_watch only. A public X list id, or a link like https://x.com/i/lists/1234567890.", "type": "string" }, { "name": "query", "displayName": "Query", "description": "keyword_watch only. A plain-language description of what the target customer posts about, or an X search. Operators pass through; engagement filters such as min_faves are rejected.", "type": "string" }, { "name": "type", "displayName": "Type", "type": "string", "required": true, "enum": ["keyword_watch", "profile_watch", "follower_watch", "list_watch"] }] } }, additionalFields["signals"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range (`invalid_parameter`), or the create was rejected upstream (`invalid_request`)." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), shared-account write (`writes_main_account_only`), expired subscription, or reached agent limit (`cap_reached`). Shared accounts are read-only; your linked accounts remain writable." }, "404": { "title": "No contact list with that id belongs to this account." }, "409": { "title": "The Idempotency-Key was already used with a different request body." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "deleteSignalAgent": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/signals/agents/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "The agent_id is not one of your signal agents (`agent_not_found`), or account_id is not one of your accounts (`account_not_found`)." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "expandIcp": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/signals/icp/expand";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        setBodyField(body, { "name": "icp_description", "displayName": "Icp description", "description": "Who the ideal customer is, in plain language.", "type": "string", "required": true }, this.getNodeParameter("icp_description", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "Linked-account verification is temporarily unavailable (fail closed). The main account keeps working." } };
                        break;
                    }
                    case "expandIcpFromUrl": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/signals/icp/expand-from-url";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        setBodyField(body, { "name": "url", "displayName": "Url", "description": "The website to read. A bare domain is accepted.", "type": "string", "required": true }, this.getNodeParameter("url", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "account_id is not one of your accounts." }, "422": { "title": "The page could not be read (`scrape_failed`)." }, "429": { "title": "429 codes: `rate_limited`, `ai_credits_exhausted`, or `ai_action_limited`. The last uses `scope: account` for plan/feature caps and `platform` for shared live-data caps. Check `reset_at` and honor `Retry-After`; rejected actions are not charged." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "listSignalAgents": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/signals/agents";
                        const qs = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "503": { "title": "Linked-account verification is temporarily unavailable (fail closed). The main account keeps working." } };
                        break;
                    }
                    case "listSignalLeads": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/signals/leads";
                        const qs = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        if (additionalFields["agent_id"] !== undefined)
                            qs["agent_id"] = additionalFields["agent_id"];
                        if (additionalFields["deposited"] !== undefined)
                            qs["deposited"] = additionalFields["deposited"];
                        if (additionalFields["since"] !== undefined)
                            qs["since"] = additionalFields["since"];
                        if (additionalFields["until"] !== undefined)
                            qs["until"] = additionalFields["until"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "pagination"], simplified: ["data", "pagination"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "The agent_id is not one of your signal agents (`agent_not_found`), or account_id is not one of your accounts (`account_not_found`)." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "503": { "title": "Linked-account verification is temporarily unavailable (fail closed). The main account keeps working." } };
                        break;
                    }
                    case "removeSignalAgentSignal": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/signals/agents/{id}/signals/{signalId}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        path = path.split("{signalId}").join(encodeURIComponent(String(this.getNodeParameter("signalId", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "The agent id is not one of your signal agents (`agent_not_found`), or the signal id does not belong to that agent (`signal_not_found`)." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "searchLeads": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/signals/leads/search";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "description": "Which of your accounts to search as. Omit for the main account.", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        setBodyField(body, { "name": "icp_description", "displayName": "Icp description", "description": "Who counts as a good lead, in one or two sentences: role, domain,\nand the buying intent or pain that qualifies them.", "type": "string", "required": true }, this.getNodeParameter("icp_description", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "keywords", "displayName": "Keywords", "description": "Provide 2-5 short buyer-language angles (2-3 words each), such as workflows, paid tools, jargon, or symptoms. Use a 3-300 character comma-separated string or string list. Do not use the product name, full sentences, or search operators.", "type": "alternative", "required": true, "composition": "oneOf", "representation": "raw", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "type": "string" }, { "name": "alternative2", "displayName": "Alternative2", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, this.getNodeParameter("keywords", itemIndex), this, itemIndex);
                        if (additionalFields["max_leads"] !== undefined)
                            setBodyField(body, { "name": "max_leads", "displayName": "Max leads", "type": "integer", "minValue": 1, "maxValue": 30, "default": 10 }, additionalFields["max_leads"], this, itemIndex);
                        if (additionalFields["max_post_age_days"] !== undefined)
                            setBodyField(body, { "name": "max_post_age_days", "displayName": "Max post age days", "description": "Only posts written within the last N days count. Older matching\nposts are skipped and counted in `freshness.stale_skipped`. Use 7\nfor a pain point or buying intent worth catching while it is\nfresh, 1-3 for today, 30 for anyone who is simply active.", "type": "integer", "minValue": 1, "maxValue": 90, "default": 30 }, additionalFields["max_post_age_days"], this, itemIndex);
                        if (additionalFields["offer"] !== undefined)
                            setBodyField(body, { "name": "offer", "displayName": "Offer", "description": "Optional one-sentence description of the product or service. It guides the search toward people discussing the problem, not only those naming the product.", "type": "string" }, additionalFields["offer"], this, itemIndex);
                        if (additionalFields["precision"] !== undefined)
                            setBodyField(body, { "name": "precision", "displayName": "Precision", "description": "high keeps only confident matches; discovery also returns adjacent ones.", "type": "string", "enum": ["high", "discovery"], "default": "discovery" }, additionalFields["precision"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "note"], simplified: ["data", "note"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "429 codes: `rate_limited`, `ai_credits_exhausted`, or `ai_action_limited`. The last uses `scope: account` for plan/feature caps and `platform` for shared live-data caps. Check `reset_at` and honor `Retry-After`; rejected actions are not charged." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "Linked-account verification is temporarily unavailable (fail closed). The main account keeps working." } };
                        break;
                    }
                    case "setSignalLeadFeedback": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/signals/leads/{id}/feedback";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "description": "Any account you own, meaning your main account (the default when omitted) or one linked to it. An account shared with you returns `403 writes_main_account_only`.", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        setBodyField(body, { "name": "feedback", "displayName": "Feedback", "description": "fit = a good lead, not_fit = a bad one, null clears the verdict.", "type": "string", "required": true, "enum": ["fit", "not_fit", null], "nullable": true }, this.getNodeParameter("feedback", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "No lead with that id belongs to this account (`lead_not_found`), or account_id is not one of your accounts (`account_not_found`)." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "suggestKeywords": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/signals/keywords/suggest";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        setBodyField(body, { "name": "icp_description", "displayName": "Icp description", "description": "Who the ideal customer is, in plain language.", "type": "string", "required": true }, this.getNodeParameter("icp_description", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "Linked-account verification is temporarily unavailable (fail closed). The main account keeps working." } };
                        break;
                    }
                    case "updateSignalAgent": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/signals/agents/{id}";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        if (additionalFields["destination_list_id"] !== undefined)
                            setBodyField(body, { "name": "destination_list_id", "displayName": "Destination list id", "description": "Contact list id (from `GET /v1/contact-lists`) that receives the leads.", "type": "string" }, additionalFields["destination_list_id"], this, itemIndex);
                        if (additionalFields["icp_description"] !== undefined)
                            setBodyField(body, { "name": "icp_description", "displayName": "Icp description", "type": "string" }, additionalFields["icp_description"], this, itemIndex);
                        if (additionalFields["name"] !== undefined)
                            setBodyField(body, { "name": "name", "displayName": "Name", "type": "string" }, additionalFields["name"], this, itemIndex);
                        if (additionalFields["precision_mode"] !== undefined)
                            setBodyField(body, { "name": "precision_mode", "displayName": "Precision mode", "type": "string", "enum": ["high", "discovery"] }, additionalFields["precision_mode"], this, itemIndex);
                        if (additionalFields["status"] !== undefined)
                            setBodyField(body, { "name": "status", "displayName": "Status", "type": "string", "enum": ["active", "paused"] }, additionalFields["status"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "PATCH", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "The agent id is not one of your signal agents (`agent_not_found`), the `destination_list_id` is not one of your usable contact lists (`list_not_found`), or account_id is not one of your accounts (`account_not_found`)." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "createTag": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/tags";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "description": "Only your main account (the default when omitted). Tags are workspace-wide, so any other account you own returns `403 writes_main_account_only`.", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        if (additionalFields["color"] !== undefined)
                            setBodyField(body, { "name": "color", "displayName": "Color", "type": "string", "default": "blue" }, additionalFields["color"], this, itemIndex);
                        setBodyField(body, { "name": "name", "displayName": "Name", "type": "string", "required": true }, this.getNodeParameter("name", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an `account_id` other than your main account (`writes_main_account_only`; tags are workspace-wide), or a lapsed subscription (legacy string envelope)." }, "409": { "title": "A tag with that name already exists." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "deleteTag": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/tags/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an `account_id` other than your main account (`writes_main_account_only`; tags are workspace-wide), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "No tag with that id belongs to this account." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "listTags": {
                        const path = "/v1/tags";
                        const qs = {};
                        const body = {};
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "updateTag": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/tags/{id}";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "description": "Only your main account (the default when omitted). Tags are workspace-wide, so any other account you own returns `403 writes_main_account_only`.", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        if (additionalFields["color"] !== undefined)
                            setBodyField(body, { "name": "color", "displayName": "Color", "type": "string" }, additionalFields["color"], this, itemIndex);
                        if (additionalFields["name"] !== undefined)
                            setBodyField(body, { "name": "name", "displayName": "Name", "type": "string" }, additionalFields["name"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "PATCH", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an `account_id` other than your main account (`writes_main_account_only`; tags are workspace-wide), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "No tag with that id belongs to this account." }, "409": { "title": "A tag with that name already exists." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "factCheckText": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/tools/factcheck";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        setBodyField(body, { "name": "text", "displayName": "Text", "description": "The statement to check.", "type": "string", "required": true }, this.getNodeParameter("text", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "meta"], simplified: ["data", "meta"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "429": { "title": "429 codes: `rate_limited`, `ai_credits_exhausted`, or `ai_action_limited`. The last uses `scope: account` for plan/feature caps and `platform` for shared live-data caps. Check `reset_at` and honor `Retry-After`; rejected actions are not charged." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "Linked-account verification is temporarily unavailable (fail closed). The main account keeps working." } };
                        break;
                    }
                    case "inlineEditText": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/tools/inline-edit";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        if (additionalFields["edit_type"] !== undefined)
                            setBodyField(body, { "name": "edit_type", "displayName": "Edit type", "description": "A preset edit. The last five are older names kept working.", "type": "string", "enum": ["grammar", "translate", "hook", "details", "concise", "engaging", "humorous", "creative", "sarcastic", "inspirational", "fix-grammar", "expand", "simplify", "rewrite", "change-tone"] }, additionalFields["edit_type"], this, itemIndex);
                        if (additionalFields["full_text"] !== undefined)
                            setBodyField(body, { "name": "full_text", "displayName": "Full text", "description": "The whole post the selection sits in, so the edit matches its style.", "type": "string" }, additionalFields["full_text"], this, itemIndex);
                        if (additionalFields["instruction"] !== undefined)
                            setBodyField(body, { "name": "instruction", "displayName": "Instruction", "description": "Free-text direction, e.g. 'make this one line, lowercase'.", "type": "string" }, additionalFields["instruction"], this, itemIndex);
                        setBodyField(body, { "name": "text", "displayName": "Text", "description": "The selected piece of the post to edit.", "type": "string", "required": true }, this.getNodeParameter("text", itemIndex), this, itemIndex);
                        if (additionalFields["thread_context"] !== undefined)
                            setBodyField(body, { "name": "thread_context", "displayName": "Thread context", "description": "The thread's other parts, in order, for context only.", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, additionalFields["thread_context"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "meta"], simplified: ["data", "meta"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "429": { "title": "429 codes: `rate_limited`, `ai_credits_exhausted`, or `ai_action_limited`. The last uses `scope: account` for plan/feature caps and `platform` for shared live-data caps. Check `reset_at` and honor `Retry-After`; rejected actions are not charged." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "Linked-account verification is temporarily unavailable (fail closed). The main account keeps working." } };
                        break;
                    }
                    case "postTriage": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/posts/triage";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        if (additionalFields["max_age_days"] !== undefined)
                            setBodyField(body, { "name": "max_age_days", "displayName": "Max age days", "description": "How far back to search, in days.", "type": "integer", "minValue": 1, "maxValue": 7, "default": 3 }, additionalFields["max_age_days"], this, itemIndex);
                        setBodyField(body, { "name": "query", "displayName": "Query", "description": "What to search for, on one line: a topic, a phrase, a hashtag, or\na search expression with quotes or operators. A plain multi-word\nquery is also searched as an exact phrase.", "type": "string", "required": true }, this.getNodeParameter("query", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "meta"], simplified: ["data", "meta"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "429": { "title": "429 codes: `rate_limited`, `ai_credits_exhausted`, or `ai_action_limited`. The last uses `scope: account` for plan/feature caps and `platform` for shared live-data caps. Check `reset_at` and honor `Retry-After`; rejected actions are not charged." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "`upstream_unavailable` when live X data is throttling SuperX, or\n`accounts_unavailable` when linked-account verification is briefly\nunreadable. Both are safe to retry; nothing was charged." } };
                        break;
                    }
                    case "postViralScore": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/posts/viral-score";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        if (additionalFields["baseline"] !== undefined)
                            setBodyField(body, { "name": "baseline", "displayName": "Baseline", "description": "`account` (the default) scores against the account's own recent\nposts; `population` scores against the average training post. An\naccount with too little history falls back to `population`.", "type": "string", "enum": ["account", "population"] }, additionalFields["baseline"], this, itemIndex);
                        if (additionalFields["has_image"] !== undefined)
                            setBodyField(body, { "name": "has_image", "displayName": "Has image", "description": "True when an image would be attached.", "type": "boolean" }, additionalFields["has_image"], this, itemIndex);
                        if (additionalFields["has_video"] !== undefined)
                            setBodyField(body, { "name": "has_video", "displayName": "Has video", "description": "True when a video would be attached.", "type": "boolean" }, additionalFields["has_video"], this, itemIndex);
                        if (additionalFields["is_quote"] !== undefined)
                            setBodyField(body, { "name": "is_quote", "displayName": "Is quote", "description": "True when the post quotes another post.", "type": "boolean" }, additionalFields["is_quote"], this, itemIndex);
                        if (additionalFields["post_at"] !== undefined)
                            setBodyField(body, { "name": "post_at", "displayName": "Post at", "description": "When it would go out (ISO-8601 with an explicit Z or offset). Defaults to now.", "type": "string", "format": "date-time" }, additionalFields["post_at"], this, itemIndex);
                        setBodyField(body, { "name": "text", "displayName": "Text", "description": "The draft to score.", "type": "string", "required": true }, this.getNodeParameter("text", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "meta"], simplified: ["data", "meta"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "429": { "title": "429 codes: `rate_limited`, `ai_credits_exhausted`, or `ai_action_limited`. The last uses `scope: account` for plan/feature caps and `platform` for shared live-data caps. Check `reset_at` and honor `Retry-After`; rejected actions are not charged." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "Linked-account verification is temporarily unavailable (fail closed). The main account keeps working." } };
                        break;
                    }
                    case "rephraseText": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/tools/rephrase";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        setBodyField(body, { "name": "text", "displayName": "Text", "type": "string", "required": true }, this.getNodeParameter("text", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "type", "displayName": "Type", "description": "Which rewrite to apply.", "type": "string", "required": true, "enum": ["improve", "grammar", "translate", "hook", "details", "clarity", "engaging", "humorous", "positive", "creative", "sarcastic", "inspirational", "concise"] }, this.getNodeParameter("type", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "meta"], simplified: ["data", "meta"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "429": { "title": "429 codes: `rate_limited`, `ai_credits_exhausted`, or `ai_action_limited`. The last uses `scope: account` for plan/feature caps and `platform` for shared live-data caps. Check `reset_at` and honor `Retry-After`; rejected actions are not charged." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "Linked-account verification is temporarily unavailable (fail closed). The main account keeps working." } };
                        break;
                    }
                    case "dismissWorkerSuggestion": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/workers/suggestions/{id}/dismiss";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "description": "Any account you own, meaning your main account (the default when omitted) or one linked to it. An account shared with you returns `403 writes_main_account_only`.", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "No Worker suggestion with that id belongs to this account (`suggestion_not_found`), or account_id is not one of your accounts (`account_not_found`)." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "draftWorkerSuggestion": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/workers/suggestions/{id}/draft";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "description": "Any account you own, meaning your main account (the default when omitted) or one linked to it. An account shared with you returns `403 writes_main_account_only`.", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "The suggestion is already saved (`already_saved`), dismissed (`already_dismissed`), or has invalid input (`invalid_parameter`), including a `scheduled_for` timestamp not in UTC ISO 8601 or less than 60 seconds ahead." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "No Worker suggestion with that id belongs to this account (`suggestion_not_found`), or account_id is not one of your accounts (`account_not_found`)." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "listWorkerSuggestions": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/workers/suggestions";
                        const qs = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        if (additionalFields["status"] !== undefined)
                            qs["status"] = additionalFields["status"];
                        if (additionalFields["worker_id"] !== undefined)
                            qs["worker_id"] = additionalFields["worker_id"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["page"] !== undefined)
                            qs["page"] = additionalFields["page"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "pagination"], simplified: ["data", "pagination"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "The worker_id is not one of your Workers (`worker_not_found`), or account_id is not one of your accounts (`account_not_found`)." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "503": { "title": "Linked-account verification is temporarily unavailable (fail closed). The main account keeps working." } };
                        break;
                    }
                    case "listWorkers": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/v1/workers";
                        const qs = {};
                        const body = {};
                        if (additionalFields["account_id"] !== undefined)
                            qs["account_id"] = additionalFields["account_id"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "account_id is not one of your accounts." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "503": { "title": "Linked-account verification is temporarily unavailable (fail closed). The main account keeps working." } };
                        break;
                    }
                    case "scheduleWorkerSuggestion": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/workers/suggestions/{id}/schedule";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["account_id"] !== undefined)
                            setBodyField(body, { "name": "account_id", "displayName": "Account id", "description": "Any account you own, meaning your main account (the default when omitted) or one linked to it. An account shared with you returns `403 writes_main_account_only`.", "type": "string" }, additionalFields["account_id"], this, itemIndex);
                        if (additionalFields["autoDelete"] !== undefined)
                            setBodyField(body, { "name": "autoDelete", "displayName": "Auto Delete", "description": "Auto Delete settings for this post, in the composer's own shape. Omit to leave it off.", "type": "object", "representation": "raw", "nullable": true }, additionalFields["autoDelete"], this, itemIndex);
                        if (additionalFields["autoPlug"] !== undefined)
                            setBodyField(body, { "name": "autoPlug", "displayName": "Auto Plug", "description": "Auto Plug settings for this post, in the composer's own shape. Omit to leave it off.", "type": "object", "representation": "raw", "nullable": true }, additionalFields["autoPlug"], this, itemIndex);
                        if (additionalFields["autoRetweet"] !== undefined)
                            setBodyField(body, { "name": "autoRetweet", "displayName": "Auto Retweet", "description": "Auto Retweet settings for this post, in the composer's own shape. Omit to leave it off.", "type": "object", "representation": "raw", "nullable": true }, additionalFields["autoRetweet"], this, itemIndex);
                        if (additionalFields["enablePostingBsky"] !== undefined)
                            setBodyField(body, { "name": "enablePostingBsky", "displayName": "Enable Posting Bsky", "description": "Also cross-post it to Bluesky. Omit to leave the account's own behaviour unchanged.", "type": "boolean" }, additionalFields["enablePostingBsky"], this, itemIndex);
                        if (additionalFields["enablePostingTwitter"] !== undefined)
                            setBodyField(body, { "name": "enablePostingTwitter", "displayName": "Enable Posting Twitter", "description": "Post it to X. Omit to leave the account's own behaviour unchanged.", "type": "boolean" }, additionalFields["enablePostingTwitter"], this, itemIndex);
                        setBodyField(body, { "name": "scheduled_for", "displayName": "Scheduled for", "description": "When to post it. UTC ISO-8601 with an explicit Z or offset, at least 60 seconds in the future.", "type": "string", "format": "date-time", "required": true }, this.getNodeParameter("scheduled_for", itemIndex), this, itemIndex);
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "The suggestion is already saved (`already_saved`), dismissed (`already_dismissed`), or has invalid input (`invalid_parameter`), including a `scheduled_for` timestamp not in UTC ISO 8601 or less than 60 seconds ahead." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Read-only key (`insufficient_scope`), an account shared with you (`writes_main_account_only`; shared accounts are read-only through the API, your own linked accounts are not), or a lapsed subscription (legacy string envelope)." }, "404": { "title": "No Worker suggestion with that id belongs to this account (`suggestion_not_found`), or account_id is not one of your accounts (`account_not_found`)." }, "429": { "title": "Rate limit exceeded (limits vary by plan). Honor Retry-After." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "getXPostReplies": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/x/posts/{id}/replies";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "No public post was found: its ID may be wrong or the post may be deleted or protected. Upstream read failures can look the same; retry once before treating it as missing." }, "429": { "title": "Live lookup `429`: `rate_limited` is an enrichment cap; `lookup_quota_exceeded` is the daily quota gate. Both include `Retry-After`. `limit` identifies account quota; without it, the platform limit or counter is unavailable. Use `error.retry_after`." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "getXUserPosts": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/x/users/{handle}/posts";
                        const qs = {};
                        const body = {};
                        path = path.split("{handle}").join(encodeURIComponent(String(this.getNodeParameter("handle", itemIndex))));
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["exclude_reposts"] !== undefined)
                            qs["exclude_reposts"] = additionalFields["exclude_reposts"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "No public X account matches that handle (suspended, renamed, or misspelled)." }, "429": { "title": "Live lookup `429`: `rate_limited` is an enrichment cap; `lookup_quota_exceeded` is the daily quota gate. Both include `Retry-After`. `limit` identifies account quota; without it, the platform limit or counter is unavailable. Use `error.retry_after`." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "lookupXPost": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/v1/x/posts/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["include_quotes"] !== undefined)
                            qs["include_quotes"] = additionalFields["include_quotes"];
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "No public post was found: its ID may be wrong or the post may be deleted or protected. Upstream read failures can look the same; retry once before treating it as missing." }, "429": { "title": "Live lookup `429`: `rate_limited` is an enrichment cap; `lookup_quota_exceeded` is the daily quota gate. Both include `Retry-After`. `limit` identifies account quota; without it, the platform limit or counter is unavailable. Use `error.retry_after`." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    case "lookupXUser": {
                        let path = "/v1/x/users/{handle}";
                        const qs = {};
                        const body = {};
                        path = path.split("{handle}").join(encodeURIComponent(String(this.getNodeParameter("handle", itemIndex))));
                        const serverBaseUrl = { url: "https://api.superx.so", blockRedirects: false };
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "superxApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "A parameter is missing, malformed, or out of range." }, "401": { "title": "Missing/malformed Authorization header (`unauthorized`) or an unknown/revoked key (`invalid_api_key`)." }, "403": { "title": "Subscription lapsed. NOTE the legacy body shape: `error` is a plain\nstring here, not the `{ code, message }` object. Read-only keys on\nwrite endpoints instead get the object envelope with code\n`insufficient_scope`." }, "404": { "title": "No public X account matches that handle (suspended, renamed, or misspelled)." }, "429": { "title": "Live lookup `429`: `rate_limited` is an enrichment cap; `lookup_quota_exceeded` is the daily quota gate. Both include `Retry-After`. `limit` identifies account quota; without it, the platform limit or counter is unavailable. Use `error.retry_after`." }, "500": { "title": "Unexpected server error. May also use the legacy string envelope when subscription verification fails." }, "502": { "title": "A dependent SuperX service returned an unexpected response." }, "503": { "title": "The scheduling service is temporarily unreachable. Safe to retry; reuse your Idempotency-Key on POST." } };
                        break;
                    }
                    default: throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Unsupported operation ${operation} for node version ${nodeVersion}`, { itemIndex });
                }
                const returnAll = pagination.style !== 'none' ? Boolean((_a = nodeOptions.returnAll) !== null && _a !== void 0 ? _a : false) : false;
                const resultLimit = pagination.style !== 'none' && !returnAll ? Number((_b = nodeOptions.resultLimit) !== null && _b !== void 0 ? _b : 50) : Math.min(pagination.maxItems, Number.POSITIVE_INFINITY);
                const pageStartTime = Date.now();
                const seenCursors = new Map();
                const seenPages = new Map();
                let page = 1;
                let offset = 0;
                let cursor;
                let pagesFetched = 0;
                let estimatedBytes = 0;
                let finished = false;
                while (!finished && output.length - outputStart < resultLimit && pagesFetched < pagination.maxPages) {
                    if (Date.now() - pageStartTime > pagination.maxElapsedMs)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination elapsed-time budget was exceeded', { itemIndex });
                    const qs = options.qs;
                    if (pagination.limit && (pagesFetched > 0 || qs[pagination.limit] === undefined))
                        qs[pagination.limit] = Math.min(pagination.pageSize, resultLimit - (output.length - outputStart));
                    if (pagination.style === 'offset' && pagination.page)
                        qs[pagination.page] = offset;
                    if (pagination.style === 'pageNumber' && pagination.page)
                        qs[pagination.page] = page;
                    if (pagination.style === 'cursor' && pagination.cursor && cursor)
                        qs[pagination.cursor] = cursor;
                    const response = await (0, http_1.requestWithRetry)(this, options, credentialApplications, retryContract, itemIndex);
                    pagesFetched += 1;
                    const pageFingerprint = JSON.stringify(response);
                    const pageRepeats = ((_c = seenPages.get(pageFingerprint)) !== null && _c !== void 0 ? _c : 0) + 1;
                    seenPages.set(pageFingerprint, pageRepeats);
                    if (pageRepeats > pagination.repeatedPageLimit)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination repeated-page budget was exceeded', { itemIndex });
                    estimatedBytes += pageFingerprint.length;
                    if (estimatedBytes > pagination.maxMemoryBytes)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination memory budget was exceeded', { itemIndex });
                    if (responsePlan.binary) {
                        const binaryPayload = responsePlan.full ? ((_d = response.body) !== null && _d !== void 0 ? _d : response) : response;
                        const responseHeaders = (_e = (responsePlan.full ? response.headers : undefined)) !== null && _e !== void 0 ? _e : {};
                        const contentType = String((_f = responseHeaders['content-type']) !== null && _f !== void 0 ? _f : '').split(';')[0].trim() || 'application/octet-stream';
                        const binaryData = await this.helpers.prepareBinaryData(Buffer.from(binaryPayload), undefined, contentType);
                        output.push({ json: {}, binary: { data: binaryData }, pairedItem: { item: itemIndex } });
                        finished = true;
                        continue;
                    }
                    const normalizedResponse = responsePlan.full ? ((_g = response.body) !== null && _g !== void 0 ? _g : response) : response;
                    const envelopeValue = valueAtPath(normalizedResponse, responsePlan.envelopePath);
                    if (responsePlan.envelopePath && envelopeValue === undefined)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Response envelope path "${responsePlan.envelopePath}" was not found`, { itemIndex });
                    const envelope = (envelopeValue !== null && envelopeValue !== void 0 ? envelopeValue : normalizedResponse);
                    const itemPath = pagination.itemPath || responsePlan.itemPath;
                    const extractedItems = valueAtPath(envelope, itemPath);
                    if (itemPath && extractedItems === undefined)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Response item path "${itemPath}" was not found`, { itemIndex });
                    const deletedFallback = options.method === 'DELETE' && (normalizedResponse === undefined || normalizedResponse === null || normalizedResponse === '' ||
                        (typeof normalizedResponse === 'object' && !Array.isArray(normalizedResponse) && Object.keys(normalizedResponse).length === 0));
                    const values = deletedFallback
                        ? [{ deleted: true }]
                        : Array.isArray(extractedItems) ? extractedItems : Array.isArray(normalizedResponse) ? normalizedResponse : [extractedItems !== null && extractedItems !== void 0 ? extractedItems : envelope];
                    const outputMode = responsePlan.fields.length > 10 ? this.getNodeParameter('outputMode', itemIndex, 'simplified') : 'raw';
                    const selectedFields = outputMode === 'selected' ? this.getNodeParameter('selectedFields', itemIndex, []) : [];
                    for (const value of values) {
                        if (output.length - outputStart >= resultLimit)
                            break;
                        const fields = outputMode === 'simplified' ? responsePlan.simplified : outputMode === 'selected' ? selectedFields : [];
                        output.push({ json: selectResponseFields(value, fields), pairedItem: { item: itemIndex } });
                    }
                    if (!returnAll || pagination.style === 'none' || values.length === 0) {
                        finished = true;
                        continue;
                    }
                    if (pagination.hasMore && envelope[pagination.hasMore] === false) {
                        finished = true;
                        continue;
                    }
                    if (pagination.style === 'cursor') {
                        cursor = pagination.responseCursor ? valueAtPath(envelope, pagination.responseCursor) : undefined;
                        finished = !cursor;
                        if (cursor) {
                            const key = String(cursor);
                            const repeats = ((_h = seenCursors.get(key)) !== null && _h !== void 0 ? _h : 0) + 1;
                            seenCursors.set(key, repeats);
                            if (repeats > pagination.repeatedCursorLimit)
                                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination repeated-cursor budget was exceeded', { itemIndex });
                        }
                    }
                    if (pagination.advancement === 'offsetByItems')
                        offset += values.length;
                    if (pagination.advancement === 'incrementPage')
                        page += 1;
                }
            }
            catch (error) {
                if (this.continueOnFail()) {
                    output.push({ json: { error: error.message }, pairedItem: { item: itemIndex } });
                    continue;
                }
                if (error instanceof n8n_workflow_1.NodeApiError) {
                    const status = String((_l = (_j = error.httpCode) !== null && _j !== void 0 ? _j : (_k = error.cause) === null || _k === void 0 ? void 0 : _k.statusCode) !== null && _l !== void 0 ? _l : 'default');
                    const planned = (_m = errorPlan[status]) !== null && _m !== void 0 ? _m : errorPlan.default;
                    if (planned) {
                        const parameterHelp = planned.parameter ? `Check the '${planned.parameter}' parameter.` : undefined;
                        const description = [planned.recovery, parameterHelp].filter(Boolean).join(' ');
                        throw new n8n_workflow_1.NodeApiError(this.getNode(), error, { itemIndex, message: planned.title, description });
                    }
                }
                if (error instanceof n8n_workflow_1.NodeApiError)
                    throw new n8n_workflow_1.NodeApiError(this.getNode(), error, { itemIndex });
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), error, { itemIndex });
            }
        }
        return [output];
    }
}
exports.Superx = Superx;
//# sourceMappingURL=Superx.node.js.map