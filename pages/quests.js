import { waitForElm, getCookie, setCookie } from "../functions";
import { render, unmountComponentAtNode } from "react-dom";
import { useMainContract } from "../hooks/mainContract";
import { useConnectors, useAccount } from "@starknet-react/core";
import { useState, useEffect, useMemo } from "react";
import styles from "../styles/Quests.module.css";
import React from "react";
import notify from "../utils/notify";
import questList from "../utils/questList";
import QuestTransactionMenu from "../components/questTransactionMenu";
import QuestSteps from "../components/quests/questSteps";
import Loading from "../components/loading";
import waitForIndexation from "../utils/waitForIndexation";
import WalletMenu from "../components/walletmenu";
import callApi from "../utils/callApi";
import Settings from "../components/settings";
import CompleteQuestAnim from "../components/quests/completeQuestAnim";
import popup from "../utils/popup";
import config from "../utils/config";
import Common from "../components/common";
import waitForTransaction from "../utils/waitForTransaction";
import Wallets from "../components/UI/wallet";

export default function Home() {
  const { connect, connectors } = useConnectors();
  const { account } = useAccount();
  const { contract } = useMainContract();
  const [questCompleted, setQuestCompleted] = useState(false);
  const [questAction, setQuestAction] = useState("");
  const [questActionDescription, setQuestActionDescription] = useState("");
  const [questActionContent, setQuestActionContent] = useState("");
  const [loadingDatas, setLoadingDatas] = useState(false);
  const [tokenId, setTokenId] = useState(undefined);
  const [token, setToken] = useState(undefined);
  const [tokens, setTokens] = useState(undefined);
  const [tokenIds, setTokenIds] = useState(undefined);
  const [reloadDatas, setReloadDatas] = useState(false);
  const [reloadTokens, setReloadTokens] = useState(false);
  const [questProgress, playerLevel] = GetQuestProgress();
  const [menu, setMenu] = useState(null);
  const [canCompleteQuest, setCanCompleteQuest] = useState(true);
  const [userDatas, setUserDatas] = useState({});
  const [quests, setQuests] = useState([]);

  useEffect(() => {
    setQuests(questList({ identityTokenId: userDatas.identityTokenId }));
  }, [userDatas]);

  const date = new Date();
  const beginingDate = 1663432735158;
  const maxQuest = 100; //Math.floor((date.getTime() - beginingDate) / 1000 / 3600 / 24 / 7) + 2
  const daysLeftBeforeQuest =
    (beginingDate +
      1000 * 3600 * 24 * 7 +
      (maxQuest - 4) * 1000 * 3600 * 24 * 7 -
      date.getTime()) /
    1000 /
    3600 /
    24;
  const hoursLeftBeforeQuest =
    (daysLeftBeforeQuest - Math.floor(daysLeftBeforeQuest)) * 24;

  useEffect(() => {
    //setCanCompleteQuest(playerLevel < maxQuest)
  }, [tokenId, playerLevel, maxQuest]);

  useEffect(() => {
    const interval = setInterval(() => {
      setReloadDatas(!reloadDatas);
    }, 10000);
    return () => clearInterval(interval);
  }, [reloadDatas]);

  useEffect(async () => {
    if (!tokenId || !account) return;
    const userDatas = await callApi(`${config.apiUrl}get_nft_datas`, {
      tokenId: tokenId,
      player: account.address,
    });
    setUserDatas(userDatas);
    if (userDatas.identityTokenId != "0") {
      function error() {
        popup(
          "Error",
          "Your starknet identity is outdated, please click on the gear icon at the bottom right to change it. Otherwise, some quests will not work."
        );
      }
      try {
        console.log(userDatas.identityTokenId);
        const res = await (
          await fetch(
            `https://api-testnet.aspect.co/api/v0/asset/${config.starknetIdContractAddress}/${userDatas.identityTokenId}`
          )
        ).json();
        if (!res.id) error();
      } catch (e) {
        error();
        throw e;
      }
    }
  }, [tokenId, account]);

  useEffect(() => {
    if (account)
      try {
        if (reloadTokens) setReloadTokens(false);
        fetch(
          `https://api-testnet.aspect.co/api/v0/assets?owner_address=${account.address}&contract_address=${contract.address}&sort_by=minted_at&order_by=asc`
        )
          .then((res) => res.json())
          .then(async (res) => {
            setTokens(res.assets);
            const assets = res.assets.map((asset) => asset.token_id);
            setToken(res.assets[0]);
            setTokenIds(assets);
            setTokenId([assets[0], 0]);
          });
      } catch (error) {
        notify({
          message:
            "The Aspect api is currently unavailable. Please check back later.",
          warning: true,
        });
        throw error;
      }
  }, [account, reloadTokens]);

  // load player progress
  function GetQuestProgress() {
    const [progress, setProgress] = useState([]);
    const [level, setLevel] = useState(0);
    useEffect(() => {
      async function getPlayerInfos() {
        setReloadDatas(false);
        setLoadingDatas(true);
        if (questAction) {
          setQuestAction("");
          setQuestCompleted(false);
        }
        let res = [];
        res = await contract.functions.getProgress(tokenId);
        const questProgressTemp = {};
        res.progress.forEach((questId) => {
          questProgressTemp[parseInt(questId)] = true;
        });
        setProgress(questProgressTemp);
        setLevel(res.progress.length);
        setLoadingDatas(false);
      }
      if (
        ((questAction && questCompleted) ||
          questProgress.length === 0 ||
          reloadDatas) &&
        !loadingDatas &&
        account &&
        contract &&
        tokenId
          ? tokenId[0]
          : false
      )
        getPlayerInfos();
    }, [contract, account, questCompleted, tokenId, reloadDatas]);
    return [progress, level, questCompleted, questAction];
  }

  useEffect(async () => {
    const questContainer = await waitForElm("#questsContainer");
    document.querySelector("body").style.overscrollBehaviorY = "contain";
    let beginX = 0;
    let beginY = 0;
    let x = -10;
    let y = window.innerHeight / 2;
    let zoom = 1;
    await waitForElm("#questsContainer");
    move(0, 0);
    function move(moveX, moveY) {
      if (!questContainer) return;
      x = x + moveX - beginX;
      beginX = moveX;
      y = y + moveY - beginY;
      beginY = moveY;
      questContainer.style.left = x + "px";
      questContainer.style.top = y + "px";
    }
    const wheel = document.addEventListener("wheel", (e) => {
      if (e.deltaY < 0) {
        zoom = zoom * 1.1;
      }
      if (e.deltaY > 0) {
        zoom = zoom / 1.1;
      }
      //questContainer.style.transform = `scale(${zoom})`
    });
    const touchStart = document.addEventListener("touchstart", (e) => {
      beginX = e.changedTouches[0].pageX;
      beginY = e.changedTouches[0].pageY;
    });
    const touchMove = document.addEventListener("touchmove", (e) => {
      move(e.changedTouches[0].pageX, e.changedTouches[0].pageY);
    });
    let mousePressed = false;
    const mouseDown = document.addEventListener("mousedown", (e) => {
      beginX = e.clientX;
      beginY = e.clientY;
      mousePressed = true;
    });
    const mouseUp = document.addEventListener("mouseup", (e) => {
      mousePressed = 0;
    });
    const mouseMove = document.addEventListener("mousemove", (e) => {
      if (!mousePressed) return;
      move(e.clientX, e.clientY);
    });
    return () => {
      document.removeEventListener("wheel", wheel);
      document.removeEventListener("touchstart", touchStart);
      document.removeEventListener("touchmove", touchMove);
      document.removeEventListener("mousedown", mouseDown);
      document.removeEventListener("mouseup", mouseUp);
      document.removeEventListener("mousemove", mouseMove);
    };
  }, []);

  async function zoom(zoomLevel) {
    const questContainer = await waitForElm("#questsContainer");
    const oldZoom = questContainer.style.transform
      ? parseFloat(questContainer.style.transform.split("(")[1].slice(0, -1))
      : 1;
    questContainer.style.transform = `scale(${oldZoom * zoomLevel})`;
  }

  useMemo(async () => {
    try {
      // mouse movement system
      !getCookie("triedQuests") &&
        popup(
          "Welcome to the quest system!",
          `Press the left mouse button and move it (or your finger on phones and tablets) to move through the list of quests,\n then click on one of them (a circle) to start completing it.`,
          "Okay",
          function () {
            return setCookie("triedQuests", true, 10000);
          }
        );
    } catch {}
  }, []);

  // show a menu when a quest is hovered
  async function hoverPoint(quest, pointId) {
    const point = document.getElementById(pointId);
    const pointContener = document.getElementById("contentContener_" + pointId);
    const questCompleted = questProgress ? questProgress[quest.id] : false;
    render(
      <>
        <p id={"content_" + pointId}>{quest.description}</p>
        {!questCompleted || true ? (
          quest.devOnly || !canCompleteQuest ? (
            <button
              className={`global button dark ${styles.quest_start_button} ${styles.quest_start_button_locked}`}
            >
              Please wait
            </button>
          ) : (
            <button
              onClick={() => {
                switch (quest.transactionType) {
                  case 1:
                    contract.mint().then((datas) => {
                      waitForTransaction(
                        datas.transaction_hash,
                        "questTransactionStatus"
                      ).then(() => {
                        setQuestAction("");
                        setReloadDatas(true);
                        setReloadTokens(true);
                        waitForIndexation(
                          account.address,
                          contract,
                          setToken,
                          setTokenIds,
                          setTokenId,
                          setReloadDatas
                        );
                      });
                    });
                    setQuestAction("Minting your first NFT");
                    setQuestActionDescription("Please wait...");
                    setQuestActionContent(
                      <button
                        onClick={() => setQuestAction("")}
                        className="button gold big popup v2"
                      >
                        Close
                      </button>
                    );
                    break;
                  default:
                    setMenu(
                      <div className="global popup contener">
                        <div id="closeButtonContainer">
                          <svg
                            onClick={() => {
                              setMenu(null);
                              refresh();
                            }}
                            className="global popup close"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </div>
                        <h1 className="global popup title">{quest.name}</h1>
                        <p className="global popup description">
                          {quest.description}
                        </p>
                        {quest.content}
                        {
                          <QuestSteps
                            tokenId={tokenId}
                            quest={quest}
                            completeQuest={completeQuest}
                          />
                        }
                      </div>
                    );
                }
                function refresh() {
                  setReloadDatas(true);
                }
                function completeQuest() {
                  setReloadDatas(true);
                  setMenu(<CompleteQuestAnim playerLevel={playerLevel} />);
                }
              }}
              className={`button gold ${styles.quest_start_button}`}
            >
              Start
            </button>
          )
        ) : (
          <button
            className={`global button dark ${styles.quest_start_button} ${styles.quest_start_button_completed}`}
          >
            Completed
          </button>
        )}
      </>,
      pointContener
    );
    let check = setInterval(() => {
      if (point.matches(":hover") || point.matches(":focus")) return;
      clearInterval(check);
      unmountComponentAtNode(pointContener);
    }, 50);
  }

  // process quest datas
  function loadBranch(quest, pos, Y, previousQuestCompleted) {
    if (!quest) return;
    const elementPos = pos + 150;
    if (!quest.connected)
      return parseBranch(quest, elementPos, Y, previousQuestCompleted);
    function computeChildY(index) {
      if (quest.connected.length === 1) return Y;
      return Y + (200 / (quest.connected.length - 1)) * index - 100;
    }
    return (
      <div>
        {parseBranch(quest, elementPos, Y, previousQuestCompleted)}
        <div
          style={{
            left: elementPos,
            transform: `translateY(calc(-50% + ${Y}px))`,
          }}
          className={styles.horizontalLine}
        ></div>
        {quest.connected.length > 1 && (
          <div
            style={{
              left: elementPos,
              transform: `translateY(calc(-50% + ${Y}px)) translateX(150px)`,
            }}
            className={[
              styles.verticalLine,
              quest.connected[0].clear
                ? styles.bottom
                : quest.connected[quest.connected.length - 1].clear
                ? styles.top
                : null,
            ].join(" ")}
          />
        )}
        {quest.connected.map((element, index) => (
          <div key={"branch_" + quest.name + "_" + index}>
            {loadBranch(
              element,
              elementPos,
              computeChildY(index),
              quest.name
                ? questProgress
                  ? quest.id
                    ? questProgress[quest.id]
                    : true
                  : false
                : previousQuestCompleted
            )}
          </div>
        ))}
      </div>
    );
  }

  // convert quest datas to html
  function parseBranch(quest, elementPos, Y, previousQuestCompleted) {
    if (!quest.name) return null;
    const completed = questProgress ? questProgress[quest.id] : false;
    return (
      <div
        onMouseDown={() =>
          !previousQuestCompleted
            ? null
            : hoverPoint(quest, "point_" + elementPos + "_" + Y)
        }
        onMouseEnter={() =>
          !previousQuestCompleted
            ? null
            : hoverPoint(quest, "point_" + elementPos + "_" + Y)
        }
        id={"point_" + elementPos + "_" + Y}
        className={[
          styles.quest_point_contener,
          completed
            ? styles.quest_point_contener_completed
            : !canCompleteQuest
            ? styles.quest_point_contener_unavailable
            : null,
        ].join(" ")}
        style={{
          left: elementPos,
          transform: `translateY(calc(-50% + ${Y}px))`,
        }}
      >
        {!previousQuestCompleted ? null : (
          <p className={styles.quest_point_name}>{quest.name}</p>
        )}
        <div
          id={"questElement_" + quest.id}
          className={[
            styles.quest_point,
            !previousQuestCompleted ? styles.quest_point_locked : null,
          ].join(" ")}
        >
          {completed ? (
            <svg
              className={styles.quest_point_icon}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ) : !previousQuestCompleted ? (
            <svg
              className={styles.quest_point_icon}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          ) : canCompleteQuest ? (
            quest.icon
          ) : (
            <svg
              className={styles.quest_point_icon}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
          {!previousQuestCompleted ? null : (
            <div
              className={styles.point_infos_contener}
              id={quest.name && "contentContener_point_" + elementPos + "_" + Y}
            ></div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className={["default_background", styles.globalContainer].join(" ")}>
      <Common />
      <div id="questsContainer" className={styles.contener}>
        {tokenIds && tokenIds.length > 1 && (
          <div className={styles.tokensContainer}>
            {tokenIds.map((tokenId, index) => (
              <div
                onClick={() => {
                  setToken(tokens.find((token) => token.token_id === tokenId));
                  setTokenId([tokenId, 0]);
                  setReloadDatas(true);
                }}
                className={styles.token}
                key={"token_" + index}
              >
                {index}
              </div>
            ))}
          </div>
        )}
        {loadBranch(
          quests[0],
          tokenIds && tokenIds.length > 1 ? 50 : 0,
          0,
          true
        )}
        {token && (
          <div className={styles.player_infos_contener}>
            <img src={`${config.nftUri}${playerLevel ? playerLevel : 0}`} />
            <p>Level {playerLevel ? playerLevel : 0}</p>
          </div>
        )}
      </div>
      {menu}
      {questAction ? (
        <QuestTransactionMenu
          content={questActionContent}
          questCompleted={questCompleted}
          questAction={questAction}
          questActionDescription={questActionDescription}
        />
      ) : null}
      <Loading
        style={{ zoom: 0.7, opacity: loadingDatas ? 1 : 0 }}
        className={styles.loading}
      />
      {!canCompleteQuest && (
        <div key={"notification_" + Math.random()}>
          <div className={styles.warningContainer}>
            <svg
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h2>
              You have completed the maximum number of quests for the moment.
              You will be able to do one more in
              {daysLeftBeforeQuest > 1
                ? ` ${Math.floor(daysLeftBeforeQuest)} days and ${Math.floor(
                    hoursLeftBeforeQuest
                  )} hours.`
                : ` ${Math.floor(hoursLeftBeforeQuest)} hours and ${Math.floor(
                    (hoursLeftBeforeQuest - Math.floor(hoursLeftBeforeQuest)) *
                      60
                  )} minutes.`}
            </h2>
          </div>
        </div>
      )}
      <Wallets closeWallet={() => {}} hasWallet={!account} />
      <div className={styles.toolBar}>
        {playerLevel > 1 ? (
          <Settings
            contract={contract}
            account={account.address}
            tokenId={tokenId}
            playerLevel={playerLevel}
          />
        ) : null}
        <button onClick={() => zoom(1.1)} className={styles.button}>
          <svg
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
        </button>
        <button onClick={() => zoom(0.9)} className={styles.button}>
          <svg
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 12h-15"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
