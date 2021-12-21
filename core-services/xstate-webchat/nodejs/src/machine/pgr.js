const { assign } = require('xstate');
const { pgrService } = require('./service/service-loader');
const dialog = require('./util/dialog');
const localisationService = require('./util/localisation-service');
const config = require('../env-variables');
const moment = require("moment-timezone");

const pgr = {
  id: 'pgr',
  initial: 'pgrmenu',
  onEntry: assign((context, event) => {
    context.slots.pgr = {}
    context.pgr = { slots: {} };
  }),
  states: {
    pgrmenu: {
      id: 'pgrmenu',
      initial: 'question',
      states: {
        question: {
          always: [
            {
              target: '#fileComplaint',
              cond: (context) => context.intention == 'raise_a_complaint'
            },
            {
              target: 'error'
            }
          ]

        }, 
        error: {
          onEntry: assign((context, event) => dialog.sendMessage(context, dialog.get_message(dialog.global_messages.error.retry, context.user.locale), false)),
          always: 'question'
        } // pgrmenu.error
      }, // pgrmenu.states
    }, // pgrmenu
   
    fileComplaint: {
      id: 'fileComplaint',
      initial: 'type',
      states: {
        type: {
          id: 'type',
          initial: 'complaintType2Step',
          states: {
            complaintType: {
              id: 'complaintType',
              initial: 'question',
              states: {
                question: {
                  invoke: {
                    src: (context) => pgrService.fetchFrequentComplaints(context.extraInfo.tenantId),
                    id: 'fetchFrequentComplaints',
                    onDone: {
                      actions: assign((context, event) => {
                        let preamble = dialog.get_message(messages.fileComplaint.complaintType.question.preamble, context.user.locale);
                        let { complaintTypes, messageBundle } = event.data;
                        let { prompt, grammer } = dialog.constructListPromptAndGrammer(complaintTypes, messageBundle, context.user.locale, true);
                        context.grammer = grammer; // save the grammer in context to be used in next step
                        dialog.sendMessage(context, `${preamble}${prompt}`);
                      })
                    },
                    onError: {
                      target: '#system_error'
                    }
                  },
                  on: {
                    USER_MESSAGE: 'process'
                  }
                }, //question
                process: {
                  onEntry: assign((context, event) => {
                    context.intention = dialog.get_intention(context.grammer, event)
                  }),
                  always: [
                    {
                      target: '#complaintType2Step',
                      cond: (context) => context.intention == dialog.INTENTION_MORE
                    },
                    {
                      target: 'error'
                    }
                  ]
                }, // process
                error: {
                  onEntry: assign((context, event) => {
                    dialog.sendMessage(context, dialog.get_message(dialog.global_messages.error.retry, context.user.locale), false);
                  }),
                  always: 'question',
                } // error
              } // states of complaintType
            }, // complaintType
            complaintType2Step: {
              id: 'complaintType2Step',
              initial: 'complaintCategory',
              states: {
                complaintCategory: {
                  id: 'complaintCategory',
                  initial: 'question',
                  states: {
                    question: {
                      invoke: {
                        src: (context, event) => pgrService.fetchComplaintCategories(context.extraInfo.tenantId),
                        id: 'fetchComplaintCategories',
                        onDone: {
                          actions: assign((context, event) => {
                            let { complaintCategories, messageBundle } = event.data;
                            let preamble = dialog.get_message(messages.fileComplaint.complaintType2Step.category.question.preamble, context.user.locale);
                            let { prompt, grammer } = dialog.constructListPromptAndGrammer(complaintCategories, messageBundle, context.user.locale);
                            context.grammer = grammer; // save the grammer in context to be used in next step
                            dialog.sendMessage(context, preamble);
                          }),
                        },
                        onError: {
                          target: '#system_error'
                        }
                      },
                      on: {
                        USER_MESSAGE: 'process'
                      }
                    }, //question
                    process: {
                      onEntry: assign((context, event) => {
                        context.intention = dialog.get_intention(context.grammer, event, true)
                      }),
                      always: [
                        {
                          target: '#other',
                          cond: (context) => context.intention == 'Others',
                          actions: assign((context, event) => {
                            context.slots.pgr["complaint"] = context.intention;
                          })
                        },
                        {
                          target: '#complaintItem',
                          cond: (context) => context.intention != dialog.INTENTION_UNKOWN,
                          actions: assign((context, event) => {
                            context.slots.pgr["complaint"] = context.intention;
                          })
                        },
                        {
                          target: 'error'
                        }
                      ]
                    }, // process
                    error: {
                      onEntry: assign((context, event) => {
                        dialog.sendMessage(context, dialog.get_message(dialog.global_messages.error.retry, context.user.locale), false);
                      }),
                      always: 'question',
                    } // error
                  } // states of complaintCategory
                }, // complaintCategory
                complaintItem: {
                  id: 'complaintItem',
                  initial: 'question',
                  states: {
                    question: {
                      invoke: {
                        src: (context) => pgrService.fetchComplaintItemsForCategory(context.slots.pgr.complaint, context.extraInfo.tenantId),
                        id: 'fetchComplaintItemsForCategory',
                        onDone: {
                          actions: assign((context, event) => {
                            let { complaintItems, messageBundle } = event.data;
                            let preamble = dialog.get_message(messages.fileComplaint.complaintType2Step.item.question.preamble, context.user.locale);
                            let localisationPrefix = 'CS_COMPLAINT_TYPE_';
                            let complaintType = localisationService.getMessageBundleForCode(localisationPrefix + context.slots.pgr.complaint.toUpperCase());
                            preamble = preamble.replace('{{complaint}}', dialog.get_message(complaintType, context.user.locale));
                            let { prompt, grammer } = dialog.constructListPromptAndGrammer(complaintItems, messageBundle, context.user.locale, false, true);
                            context.grammer = grammer; // save the grammer in context to be used in next step
                            dialog.sendMessage(context, `${preamble}${prompt}`);
                          })
                        },
                        onError: {
                          target: '#system_error'
                        }
                      },
                      on: {
                        USER_MESSAGE: 'process'
                      }
                    }, //question
                    process: {
                      onEntry: assign((context, event) => {
                        context.intention = dialog.get_intention(context.grammer, event, true)
                      }),
                      always: [
                        {
                          target: '#complaintCategory',
                          cond: (context) => context.intention == dialog.INTENTION_GOBACK
                        },
                        {
                          target: '#other',
                          cond: (context) => context.intention != dialog.INTENTION_UNKOWN,
                          actions: assign((context, event) => {
                            context.slots.pgr["complaint"] = context.intention;
                          })
                        },
                        {
                          target: 'error'
                        }
                      ]
                    }, // process
                    error: {
                      onEntry: assign((context, event) => {
                        dialog.sendMessage(context, dialog.get_message(dialog.global_messages.error.retry, context.user.locale), false);
                      }),
                      always: 'question',
                    } // error
                  } // states of complaintItem
                }, // complaintItem
              } // states of complaintType2Step
            }, // complaintType2Step
          }
        },
        other: {
          // get other info
          id: 'other',
          initial: 'imageUpload',
          states: {
            imageUpload: {
              id: 'imageUpload',
              initial: 'question',
              states: {
                question: {
                  onEntry: assign((context, event) => {
                    let message = dialog.get_message(messages.fileComplaint.imageUpload.question, context.user.locale);
                    dialog.sendMessage(context, message);
                  }),
                  on: {
                    USER_MESSAGE: 'process'
                  }
                },
                process: {
                  onEntry: assign((context, event) => {
                    if (dialog.validateInputType(event, 'image')) {
                      context.slots.pgr.image = event.message.input;
                      context.message = {
                        isValid: true
                      };
                    }
                    else {
                      let parsed = event.message.input;
                      let isValid = (parsed === "1");
                      context.message = {
                        isValid: isValid,
                        messageContent: event.message.input
                      };
                    }
                  }),
                  always: [
                    {
                      target: 'error',
                      cond: (context, event) => {
                        return !context.message.isValid;
                      }
                    }
                   
                  ]
                },
                error: {
                  onEntry: assign((context, event) => {
                    let message = dialog.get_message(dialog.global_messages.error.retry, context.user.locale);
                    dialog.sendMessage(context, message, false);
                  }),
                  always: 'question'
                }
              }
            }
          }
        },
        persistComplaint: {
          id: 'persistComplaint',
          invoke: {
            id: 'persistComplaint',
            src: (context) => pgrService.persistComplaint(context.user, context.slots.pgr, context.extraInfo),
            onDone: {
              target: '#endstate',
              actions: assign((context, event) => {
                let complaintDetails = event.data;
                let message = dialog.get_message(messages.fileComplaint.persistComplaint, context.user.locale);
                message = message.replace('{{complaintNumber}}', complaintDetails.complaintNumber);
                message = message.replace('{{complaintLink}}', complaintDetails.complaintLink);
                let closingStatement = dialog.get_message(messages.fileComplaint.closingStatement, context.user.locale);
                message = message + closingStatement;
                dialog.sendMessage(context, message);
              })
            }
          }
        },
      }, // fileComplaint.states
    }  // fileComplaint
    
  } // pgr.states
}; // pgr

let messages = {
  pgrmenu: {
    question:  {
      en_IN: 'Please type and send the number for your option 👇\n\n1. File New Complaint.\n2. Track Old Complaints.',
      hi_IN: 'कृपया नीचे 👇 दिए गए सूची से अपना विकल्प टाइप करें और भेजें\n\n1. यदि आप शिकायत दर्ज करना चाहते हैं\n2. यदि आप अपनी शिकायतों की स्थिति देखना चाहते हैं'
    }
  },
  fileComplaint: {
    complaintType: {
      question: {
        preamble: {
          en_IN: 'What is the complaint about ? Please type and send the number of your option 👇',
          hi_IN: 'कृपया अपनी शिकायत के लिए नंबर दर्ज करें'
        },
        other: {
          en_IN: 'Other ...',
          hi_IN: 'कुछ अन्य ...'
        }
      }
    }, // complaintType
    complaintType2Step: {
      category: {
        question: {
          preamble: {
            en_IN: {message: 'What is your complaint about?', step: 'intermediate', option: [{ key: '1', value: 'Not Receiving OTP', type: 'button' }, { key: '2', value: 'Unable to Proceed Forward', type: 'button' }, { key: '3', value: 'Bill Amount is incorrect', type: 'button' }, { key: '4', value: 'Application Process taking long time', type: 'button' }, { key: '5', value: 'Application is getting rejected', type: 'button' }, { key: '6', value: 'Others', type: 'button' }] },
            hi_IN: {message: 'What is your complaint about?', step: 'intermediate', option: [{ key: '1', value: 'ओटीपी प्राप्त नहीं हो रहा है', type: 'button' }, { key: '2', value: 'आगे बढ़ने में असमर्थ', type: 'button' }, { key: '3', value: 'बिल राशि गलत है', type: 'button' }, { key: '4', value: 'आवेदन प्रक्रिया में लंबा समय लग रहा है', type: 'button' }, { key: '5', value: 'आवेदन खारिज हो रहा है', type: 'button' }, { key: '6', value: 'अन्य', type: 'button' }] }
          },
          otherType: {
            en_IN: 'Others',
            hi_IN: 'अन्य'
          }
        }
      },
      item: {
        question: {
          preamble: {
            en_IN: 'What is the problem you are facing with {{complaint}}?\n',
            hi_IN: 'कृपया {{complaint}} के लिए समस्या श्रेणी चुनें'
          },
          no_otp:{
            en_IN: {message: 'Please enter your phone number?', step: 'intermediate' },
            hi_IN: {message: 'Please enter your phone number?', step: 'intermediate' }
          },
          unable_to_proceed:{
            en_IN: {step: 'intermediate', option: [{ key: '1', value: 'Application is stuck and not moving forward', type: 'button' }, { key: '2', value: 'Application is showing unexpected error', type: 'button' }, { key: '3', value: 'Necessary Option not found', type: 'button' }] },
            hi_IN: {step: 'intermediate', option: [{ key: '1', value: 'Application is stuck and not moving forward', type: 'button' }, { key: '2', value: 'Application is showing unexpected error', type: 'button' }, { key: '3', value: 'Necessary Option not found', type: 'button' }] }
          },

        }
      },
    }, // complaintType2Step
    geoLocation: {
      question: {
        en_IN: 'Please share your location if you are at the grievance site.\n\n👉  Refer the image below to understand steps for sharing the location.\n\n👉  To continue without sharing the location, type and send  *1*.',
        hi_IN: 'यदि आप शिकायत स्थल पर हैं, तो कृपया अपना स्थान साझा करें।\n\n👉 स्थान साझा करने के चरणों को समझने के लिए कृपया नीचे दी गई छवि देखें।\n\n👉 स्थान साझा किए बिना जारी रखने के लिए, टाइप करें और *1* भेजें।'
      }
    }, // geoLocation 
    confirmLocation: {
      confirmCityAndLocality: {
        en_IN: 'Is this the correct location of the complaint?\nCity: {{city}}\nLocality: {{locality}}\n\nType and send *1* if it is incorrect\nElse, type and send *2* to confirm and proceed',
        hi_IN: 'क्या यह शिकायत का सही स्थान है?\nशहर: {{city}} \n स्थान: {{locality}} \n अगर यह गलत है तो कृपया "No" भेजें ।'
      },
      confirmCity: {
        en_IN: 'Is this the correct location of the complaint?\nCity: {{city}}\n\nType and send *1* if it is incorrect\nElse, type and send *2* to confirm and proceed',
        hi_IN: 'क्या यह शिकायत का सही स्थान है? \nशहर: {{city}}\n अगर यह गलत है तो कृपया "No" भेजें।\nअन्यथा किसी भी चरित्र को टाइप करें और आगे बढ़ने के लिए भेजें।'
      }
    },
    city: {
      question: {
        preamble: {
          en_IN: 'Please select your city from the link given below. Tap on the link to search and select your city.',
          hi_IN: 'कृपया नीचे दिए गए लिंक से अपने शहर का चयन करें। अपने शहर को खोजने और चुनने के लिए लिंक पर टैप करें।'
        }
      }
    }, // city
    locality: {
      question: {
        preamble: {
          en_IN: 'Please select the locality of your complaint from the link below. Tap on the link to search and select a locality.',
          hi_IN: 'कृपया नीचे दिए गए लिंक से अपनी शिकायत के इलाके का चयन करें। किसी इलाके को खोजने और चुनने के लिए लिंक पर टैप करें।'
        }
      }
    }, // locality
    imageUpload: {
      question: {
        en_IN: 'If possible, attach a photo of your grievance.\n\nTo continue without photo, type and send *1*',
        hi_IN: 'यदि संभव हो, तो कृपया अपनी शिकायत के बारे में एक फोटो संलग्न करें।\n\nबिना फोटो के जारी रखने के लिए, टाइप करें और भेजें *1*'
      },
      error: {
        en_IN: 'Sorry, I didn\'t understand',
        hi_IN: 'क्षमा करें, मुझे समझ नहीं आया ।',
      }
    },
    persistComplaint: {
      en_IN: 'Thank You 😃 Your complaint is registered successfully with mSeva.\n\nThe Complaint No is : *{{complaintNumber}}*\n\nClick on the link below to view and track your complaint:\n{{complaintLink}}\n',
      hi_IN: 'धन्यवाद! आपने mSeva Punjab के माध्यम से सफलतापूर्वक शिकायत दर्ज की है।\nआपकी शिकायत संख्या: {{complaintNumber}}\n आप नीचे दिए गए लिंक के माध्यम से अपनी शिकायत देख और ट्रैक कर सकते हैं:\n {{complaintLink}}\n'
    },
    closingStatement: {
      en_IN: '\nIn case of any help please type and send "mseva"',
      hi_IN: '\nजब भी आपको मेरी सहायता की आवश्यकता हो तो कृपया "mseva" लिखें और भेजें'
    },
    cityFuzzySearch: {
      question: {
        en_IN: "Enter the name of your city.\n\n(For example - Jalandhar, Amritsar, Ludhiana)",
        hi_IN: "कृपया अपने शहर का नाम दर्ज करें। उदाहरण के लिए - जालंधर, अमृतसर, लुधियाना"
      },
      confirmation: {
        en_IN: "Did you mean *“{{city}}”* ?\n\n👉  Type and send *1* to confirm.\n\n👉  Type and send *2* to write again.",
        hi_IN: "क्या आपका मतलब *“{{city}}”* ?\n\n👉 टाइप करें और पुष्टि करने के लिए *1* भेजें।\n\n👉 फिर से लिखने के लिए *2* टाइप करें और भेजें।"
      },
      noRecord: {
        en_IN: 'The provided city is either incorrect or not present in our record.\nPlease enter the details again.',
        hi_IN: 'आपके द्वारा दर्ज किया गया शहर गलत वर्तनी वाला है या हमारे सिस्टम रिकॉर्ड में मौजूद नहीं है।\nकृपया फिर से विवरण दर्ज करें।'
      }
    },
    localityFuzzySearch: {
      question: {
        en_IN: "Enter the name of your locality.\n\n(For example - Ajit Nagar)",
        hi_IN: "कृपया अपने शहर का नाम दर्ज करें। उदाहरण के लिए - अजीत नगर, मोहल्ला कांगो"
      },
      confirmation: {
        en_IN: "Did you mean *“{{locality}}”* ?\n\n👉  Type and send *1* to confirm.\n\n👉  Type and send *2* to write again.",
        hi_IN: "क्या आपका मतलब *“{{locality}}”* ?\n\n👉 टाइप करें और पुष्टि करने के लिए *1* भेजें।\n\n👉 फिर से लिखने के लिए *2* टाइप करें और भेजें।"
      },
      noRecord: {
        en_IN: 'The provided locality is either incorrect or not present in our record.\nPlease enter the details again.',
        hi_IN: 'आपके द्वारा दर्ज किया गया स्थान गलत वर्तनी वाला है या हमारे सिस्टम रिकॉर्ड में मौजूद नहीं है।\nकृपया फिर से विवरण दर्ज करें।'
      }
    }
  }, // fileComplaint
  trackComplaint: {
    noRecords: {
      en_IN: 'Sorry 😥 No complaints are found registered from this mobile number.\n\n👉 To go back to the main menu, type and send mseva.',
      hi_IN: 'अब आपके द्वारा पंजीकृत कोई खुली शिकायत नहीं है।\nमुख्य मेनू पर वापस जाने के लिए ‘mseva’ टाइप करें और भेजें ।'
    },
    results: {
      preamble: {
        en_IN: 'Following are your open complaints',
        hi_IN: 'आपकी पंजीकृत ओपन शिकायतें'
      },
      complaintTemplate: {
        en_IN: '*{{complaintType}}*\n\nFiled Date: {{filedDate}}\n\nCurrent Complaint Status: *{{complaintStatus}}*\n\nTap on the link below to view details\n{{complaintLink}}',
        hi_IN: '*{{complaintType}}*\n\nदायर तिथि: {{filedDate}}\n\nशिकायत की स्थिति: *{{complaintStatus}}*\n\nशिकायत देखने के लिए नीचे दिए गए लिंक पर टैप करें\n{{complaintLink}}'
      },
      closingStatement: {
        en_IN: '👉 To go back to the main menu, type and send mseva.',
        hi_IN: '👉 मुख्य मेनू पर वापस जाने के लिए, टाइप करें और mseva भेजें।'
      }
    }
  }
}; // messages

let grammer = {
  pgrmenu: {
    question: [
      { intention: 'raise_a_complaint', recognize: ['1', 'file', 'new'] },
      { intention: 'track_existing_complaints', recognize: ['2', 'track', 'existing'] }
    ]
  },
  confirmation: {
    choice: [
      { intention: 'Yes', recognize: ['1',] },
      { intention: 'No', recognize: ['2'] }
    ]
  }
};
module.exports = pgr;
