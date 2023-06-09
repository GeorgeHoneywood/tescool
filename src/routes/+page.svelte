<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import Spinner from '../components/Spinner.svelte';
	import { invalidateAll } from '$app/navigation';
	import { getLocalTodayString, type Item } from '../util';
	import { slide } from 'svelte/transition';

	export let data: PageData;

	let loading = true;
	let error: Error | null = null;
	let items: Item[] | null = null;
	let index = 0;
	let type = '';

	let guess: number | null = null;
	let submitted = false;
	let finished = false;

	let score = 0;
	let roundEmoji: string[] = [];
	let newHighscore = false;

	let percentOff = 0;
	let roundBracket: bracket | null = null;

	let newDayChecker = 0;
	let shared = false;

	type bracket = {
		text: string;
		color: string;
		emoji: string;
	};

	const roundBrackets: Record<number, bracket> = {
		5: { text: 'Dead on!', color: 'green', emoji: '🟩' },
		15: { text: 'Close!', color: 'green', emoji: '🟩' },
		25: { text: 'Not bad!', color: 'orange', emoji: '🟧' },
		50: { text: 'Not too far off!', color: 'orange', emoji: '🟧' },
		Infinity: { text: 'Disgraceful!', color: 'red', emoji: '🟥' }
	};

	const checkGuess = () => {
		if (guess === null || items === null) {
			return;
		}
		submitted = true;
		percentOff = Math.abs(((guess - items[index].price) / items[index].price) * 100);
		let key = Object.keys(roundBrackets).find((e) => percentOff < +e);

		roundBracket = roundBrackets[+(key ?? Infinity)];

		// percentage off is a number between 0 and +Infinity
		score +=
			Math.max(
				100 - percentOff - 50, // only scores below 50% off get points
				0 // shouldn't be able to score negative points
			) *
			2 * // scale back up so that we can get to 5000 points
			10; // gives us a score out of 5000;
		roundEmoji.push(roundBracket.emoji);
	};

	const focus = (el: HTMLElement) => {
		el.focus({ preventScroll: true });
	};

	const next = () => {
		if (items === null) {
			return;
		}

		index++;
		if (index >= items.length) {
			finished = true;

			// if daily challenge
			if (type === 'daily') {
				document.cookie = `dailyChallengeDate=${getLocalTodayString()}; SameSite=Lax`;
			}

			// do highscore stuff here
			if (
				localStorage.getItem('highscore') === null ||
				score > +localStorage.getItem('highscore')!
			) {
				localStorage.setItem('highscore', score.toFixed(0));
				newHighscore = true;
			}

			// check if there is a new daily challenge every 2 seconds
			newDayChecker = setInterval(() => {
				if (data.loadDate !== getLocalTodayString()) {
					console.log('the date has changed');
					loading = true;
					invalidateAll().then(async () => {
						console.log('loaded new daily challenge');

						await resetState();
					});
				}
			}, 1000 * 2);

			return;
		}
		guess = null;
		submitted = false;
	};

	onMount(async () => {
		await resetState();
	});

	const getImageUrl = (e: Item): string => {
		return window.devicePixelRatio === 1 ? e.x1ImageUrl : e.x2ImageUrl;
	};

	const resetState = async () => {
		try {
			const resp = await data.streamed.tesco;
			items = resp.items;
			type = resp.type;
			loading = false;

			finished = false;
			submitted = false;
			index = 0;
			score = 0;
			guess = null;
			newHighscore = false;
			roundEmoji = [];
			shared = false;

			// precache images
			items.forEach((e) => {
				new Image().src = getImageUrl(e);
			});
		} catch (err) {
			error = err as Error;
		}
	};
</script>

<main>
	<h1>Tescool: {type !== '' ? (type === 'daily' ? 'daily' : 'free play') : ''}</h1>
	{#if loading}
		<div class="spinner">
			<Spinner />
		</div>
	{:else if error}
		<div class="error">
			<p>Failed to load data, try refreshing!</p>
			<p>{(error && error.message) ?? 'Unknown error'}</p>
		</div>
	{:else if !finished && items}
		<div class="stats">
			<span>Round: {index + 1}/5</span>
			<span style="text-align:right">Score: {score.toFixed(0)}/5000</span>
		</div>

		{#key items[index]}
			<div class="item-box" transition:slide|local>
				<img src={getImageUrl(items[index])} alt="Image of {items[index].title}" />

				<span class="name">{items[index].title}</span>
			</div>
		{/key}

		<div class="guess">
			<span>
				<span>£</span>
				<!-- key this so that autofocus works properly -->
				{#key items[index]}
					<input
						class="guess-input"
						type="number"
						min="0.00"
						max="10000.00"
						step="0.01"
						placeholder="1.34"
						autocomplete="no"
						bind:value={guess}
						on:keypress={(e) => {
							if (e.key === 'Enter') {
								!submitted ? checkGuess() : next();
							}
						}}
						use:focus
					/>
				{/key}
			</span>

			{#if !submitted}
				<button class="guess-button" on:click={() => checkGuess()} disabled={!guess}>Submit</button>
			{:else}
				<button class="guess-button" on:click={() => next()}>Next</button>
			{/if}
		</div>

		{#if submitted && roundBracket}
			<div class="actual" style="color: {roundBracket.color}">
				<span
					>Actual price: £{items[index].price.toFixed(2)} &mdash; {percentOff.toFixed(0)}% off</span
				>
				<span>{roundBracket.text}</span>
			</div>
		{/if}
	{:else}
		<h2>{type === 'daily' ? 'Daily challenge complete' : 'Random game complete'}!</h2>
		<p>You scored {score.toFixed(0)}/5000</p>

		<p class="round-emoji">{roundEmoji.join('')}</p>

		{#if newHighscore}
			<p>New highscore!</p>
		{:else}
			<p>Your highscore is: {localStorage.getItem('highscore') ?? 0}</p>
		{/if}

		<button
			class="end-action"
			use:focus
			disabled={loading}
			on:click={() => {
				// prevent auto reload if we are mid-game
				if (newDayChecker !== 0) {
					clearInterval(newDayChecker);
				}

				loading = true;

				invalidateAll().then(async () => {
					console.log('loaded random items');

					await resetState();
				});
			}}
		>
			Play random game!
		</button>

		<button
			class="end-action"
			on:click={() => {
				// TODO: refactor this out to a component
				const shareData = {
					text: `#tescool ${score.toFixed(0)}/5000 | ${roundEmoji.join('')} | ${
						window.location.href
					}`
				};

				// @ts-ignore -- navigator.share will not be defined in all browsers
				let canShare = navigator.share && navigator.canShare && navigator.canShare(shareData);
				if (canShare) {
					try {
						navigator.share(shareData);
					} catch (err) {
						console.log('failed to share', err);
						canShare = false;
					}
				}

				if (!canShare) {
					// fallback to copying to clipboard
					const el = document.createElement('textarea');
					el.value = shareData.text;
					document.body.appendChild(el);
					el.select();
					document.execCommand('copy');
					document.body.removeChild(el);
				}

				shared = true;
			}}
		>
			Share{shared ? 'd!' : ''}
		</button>
	{/if}
</main>

<style>
	main {
		max-width: 400px;
		margin: auto;
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	h1,
	h2,
	p {
		text-align: center;
	}

	h1 {
		margin: 10px 10px;
	}

	.item-box {
		display: flex;
		flex-direction: column;
		/* justify-content: space-between; */
		align-items: center;
		flex: auto;
	}

	.item-box > * {
		margin-bottom: 0.5rem;
	}

	img {
		width: 250px;
		height: 250px;
		margin: 10px auto;
	}

	.name {
		font-style: italic;
		text-align: center;
		height: 60px;
		overflow: hidden;
		text-overflow: ellipsis;
		margin: auto 20px;

		display: flex;
		justify-content: center;
		align-items: center;
	}

	.guess {
		display: flex;
		justify-content: space-between;
		/* width: 100%; */
		margin: auto 20px;
	}

	.guess-input {
		width: 85px;
		font-size: inherit;
	}

	input,
	button {
		padding: 6px;
		font-size: inherit;
	}

	.stats {
		display: flex;
		justify-content: space-between;
		margin: auto 20px;
	}

	.spinner {
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.actual {
		margin: 10px;
		text-align: center;
		display: flex;
		flex-direction: column;
	}

	.end-action {
		margin: 15px 15px 0 15px;
	}

	.guess-button {
		min-width: 100px;
	}

	.round-emoji {
		font-size: 1.4rem;
		letter-spacing: 0.4em;
	}
</style>
